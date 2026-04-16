'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type TTSStatus = 'idle' | 'loading' | 'playing' | 'error';

interface TTSResponse {
  audio: string;
  sampleRate: number;
  bitsPerSample: number;
  numChannels: number;
  mimeType: string;
}

// In-memory cache: messageId -> AudioBuffer (Gemini)
const audioCache = new Map<string, AudioBuffer>();

function decodeBase64PCMtoAudioBuffer(
  ctx: AudioContext,
  base64: string,
  sampleRate: number,
  bitsPerSample: number,
  numChannels: number
): AudioBuffer {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(bytes.length / bytesPerSample / numChannels);
  const audioBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate);
  const dataView = new DataView(bytes.buffer);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < totalSamples; i++) {
      const byteOffset = (i * numChannels + channel) * bytesPerSample;
      if (bitsPerSample === 16) {
        const sample = dataView.getInt16(byteOffset, true);
        channelData[i] = sample / 32768.0;
      } else if (bitsPerSample === 24) {
        const b0 = bytes[byteOffset];
        const b1 = bytes[byteOffset + 1];
        const b2 = bytes[byteOffset + 2];
        let sample = (b2 << 16) | (b1 << 8) | b0;
        if (sample >= 0x800000) sample -= 0x1000000;
        channelData[i] = sample / 8388608.0;
      } else {
        channelData[i] = (bytes[byteOffset] - 128) / 128.0;
      }
    }
  }

  return audioBuffer;
}

export function useTTS() {
  const [status, setStatus] = useState<TTSStatus>('idle');
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Load browser voices for fallback
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const googleId = voices.find(
        (v) => (v.lang === 'id-ID' || v.lang.startsWith('id')) && v.name.toLowerCase().includes('google')
      );
      const anyId = voices.find((v) => v.lang === 'id-ID' || v.lang.startsWith('id'));
      voiceRef.current = googleId || anyId || voices[0];
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    // Stop AudioContext source
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* */ }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    // Stop speechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Abort fetch
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus('idle');
    setPlayingMessageId(null);
  }, []);

  // --- Play via AudioContext (Gemini audio) ---
  const playAudioBuffer = useCallback(
    async (audioBuffer: AudioBuffer, messageId: string) => {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceNodeRef.current = source;

      source.onended = () => {
        setStatus('idle');
        setPlayingMessageId(null);
        sourceNodeRef.current = null;
      };

      setStatus('playing');
      setPlayingMessageId(messageId);
      source.start(0);
    },
    [getAudioContext]
  );

  // --- Fallback: play via browser speechSynthesis ---
  const playFallback = useCallback(
    (text: string, messageId: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/^[-•]\s/gm, '')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      if (voiceRef.current) utterance.voice = voiceRef.current;

      utterance.onstart = () => {
        setStatus('playing');
        setPlayingMessageId(messageId);
      };
      utterance.onend = () => {
        setStatus('idle');
        setPlayingMessageId(null);
      };
      utterance.onerror = (event) => {
        if (event.error === 'canceled') return;
        setStatus('idle');
        setPlayingMessageId(null);
      };

      console.log('TTS fallback: using browser speechSynthesis');
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  // --- Main play function ---
  const play = useCallback(
    async (text: string, messageId: string) => {
      // Toggle off
      if (playingMessageId === messageId && status === 'playing') {
        stop();
        return;
      }

      stop();

      // Check cache — instant replay
      const cached = audioCache.get(messageId);
      if (cached) {
        try {
          await playAudioBuffer(cached, messageId);
        } catch {
          setStatus('error');
          setPlayingMessageId(null);
        }
        return;
      }

      // Try Gemini TTS
      setStatus('loading');
      setPlayingMessageId(messageId);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }

        const data: TTSResponse = await res.json();
        const ctx = getAudioContext();

        const audioBuffer = decodeBase64PCMtoAudioBuffer(
          ctx,
          data.audio,
          data.sampleRate,
          data.bitsPerSample,
          data.numChannels
        );

        audioCache.set(messageId, audioBuffer);
        await playAudioBuffer(audioBuffer, messageId);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        // Fallback to browser speechSynthesis
        console.warn('Gemini TTS failed, falling back to browser voice:', err);
        playFallback(text, messageId);
      }
    },
    [playingMessageId, status, stop, playAudioBuffer, getAudioContext, playFallback]
  );

  return { status, playingMessageId, play, stop };
}
