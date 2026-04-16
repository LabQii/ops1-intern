'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type TTSMode = 'hybrid' | 'gemini' | 'synthetic';
export type TTSStatus = 'idle' | 'loading' | 'playing' | 'error';

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
  const [mode, _setMode] = useState<TTSMode>('hybrid');

  // Hydrate mode from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem('tts-mode');
    if (saved === 'gemini' || saved === 'synthetic' || saved === 'hybrid') {
      _setMode(saved);
    }
  }, []);

  const setMode = useCallback((newMode: TTSMode) => {
    _setMode(newMode);
    localStorage.setItem('tts-mode', newMode);
  }, []);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Load browser voices
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
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* */ }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
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

      // Create analyser for waveform visualization
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceNodeRef.current = source;

      source.onended = () => {
        setStatus('idle');
        setPlayingMessageId(null);
        sourceNodeRef.current = null;
        analyserRef.current = null;
      };

      setStatus('playing');
      setPlayingMessageId(messageId);
      source.start(0);
    },
    [getAudioContext]
  );

  // --- Play via browser speechSynthesis ---
  const playSynthetic = useCallback(
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

      setStatus('playing');
      setPlayingMessageId(messageId);
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  // --- Play via Gemini API ---
  const playGemini = useCallback(
    async (text: string, messageId: string): Promise<boolean> => {
      // Check cache first
      const cached = audioCache.get(messageId);
      if (cached) {
        await playAudioBuffer(cached, messageId);
        return true;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

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
      return true;
    },
    [playAudioBuffer, getAudioContext]
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
      setStatus('loading');
      setPlayingMessageId(messageId);

      try {
        if (mode === 'synthetic') {
          playSynthetic(text, messageId);
          return;
        }

        if (mode === 'gemini') {
          await playGemini(text, messageId);
          return;
        }

        // Hybrid: try Gemini, fallback to synthetic
        try {
          await playGemini(text, messageId);
        } catch (geminiErr) {
          if (geminiErr instanceof Error && geminiErr.name === 'AbortError') return;
          console.warn('Gemini TTS failed, fallback to browser:', geminiErr);
          playSynthetic(text, messageId);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('TTS error:', err);
        setStatus('error');
        setPlayingMessageId(null);
      }
    },
    [playingMessageId, status, stop, mode, playSynthetic, playGemini]
  );

  return { status, playingMessageId, mode, setMode, play, stop, analyserRef };
}
