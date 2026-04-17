'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, ToastMessage } from '@/types';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import Toast from '@/components/ui/Toast';
import { IconDocument, IconBot, IconVolume, IconVolumeOff } from '@/components/ui/Icons';
import { useTTS, TTSMode } from '@/lib/hooks/useTTS';
import { useTheme } from '@/components/providers/ThemeProvider';
import VoiceVisualizer from './VoiceVisualizer';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `Halo! Saya adalah asisten anda, ada yang bisa saya bantu?`,
  timestamp: new Date(),
};

const MODE_LABELS: Record<TTSMode, string> = {
  hybrid: 'Hybrid',
  gemini: 'Gemini AI',
  synthetic: 'Browser',
};

export default function ChatInterface() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeDocs, setActiveDocs] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [autoTTS, setAutoTTS] = useState(true);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastFinishedIdRef = useRef<string | null>(null);

  const { status: ttsStatus, playingMessageId, mode: ttsMode, setMode: setTTSMode, play: playTTS, stop: stopTTS, analyserRef } = useTTS();

  useEffect(() => {
    fetch('/api/admin/documents')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.documents) {
          setActiveDocs(data.documents.length);
        }
      })
      .catch(() => { });

    const timer = setTimeout(() => {
      setMessages([WELCOME_MSG]);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages, isTyping]);

  // Keep a stable ref to playTTS so effects don't re-trigger on mode change
  const playTTSRef = useRef(playTTS);
  useEffect(() => { playTTSRef.current = playTTS; }, [playTTS]);

  // Auto-play TTS for new assistant messages (non-welcome)
  // Uses ref for playTTS to avoid re-triggering when mode changes
  useEffect(() => {
    if (!autoTTS) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastMsg.id === 'welcome') return;
    if (lastMsg.isStreaming) return;
    if (!lastMsg.content) return;

    if (lastMsg.id !== lastFinishedIdRef.current) {
      lastFinishedIdRef.current = lastMsg.id;
      playTTSRef.current(lastMsg.content, lastMsg.id);
    }
  }, [messages, autoTTS]);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSend = async (userMessage: string) => {
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    stopTTS();
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const history = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantId = generateId();
    const ctrl = new AbortController();
    setAbortController(ctrl);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error('Request failed');

      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
              );
              break;
            }
            try {
              const { text } = JSON.parse(data);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + text } : m
                )
              );
            } catch { }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content ? m.content + '\n\n*(Dihentikan)*' : '*(Pesan dihentikan)*' }
              : m
          )
        );
      } else {
        addToast('error', 'Gagal mendapatkan respons. Coba lagi.');
      }
    } finally {
      setIsTyping(false);
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)));
      setAbortController(null);
    }
  };

  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
  }, [abortController]);

  const handlePlayTTS = useCallback(
    (text: string, messageId: string) => {
      playTTS(text, messageId);
    },
    [playTTS]
  );

  const handleModeSelect = (newMode: TTSMode) => {
    setTTSMode(newMode);
    setShowModeMenu(false);
    addToast('info', `Mode suara: ${MODE_LABELS[newMode]}`);
  };

  const isDisabled = isTyping;

  return (
    <div className="flex h-screen pt-16 bg-[var(--main-bg)]">
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Left: Chat section */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Status bar */}
        <div className={`flex items-center justify-between px-4 py-2 border-b ${theme === 'dark' ? 'border-white/6 bg-navy-dark/40' : 'border-black/5 bg-white/40'}`}>
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
            <IconBot size={13} strokeWidth={1.5} className={theme === 'dark' ? 'text-white/30' : 'text-black/30'} />
            <span className={`text-xs tracking-wide ${theme === 'dark' ? 'text-white/35' : 'text-black/40'}`}>OPS-1 AI aktif</span>
          </div>

          <div className="flex items-center gap-2">
            {/* TTS Mode Selector */}
            <div className="relative">
              <motion.button
                onClick={() => setShowModeMenu(!showModeMenu)}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-[11px] font-medium ${theme === 'dark' ? 'bg-white/4 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20' : 'bg-black/4 border-black/10 text-black/40 hover:text-black/60 hover:border-black/20'}`}
              >
                <span>🎤</span>
                <span>{MODE_LABELS[ttsMode]}</span>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${showModeMenu ? 'rotate-180' : ''}`}>
                  <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </motion.button>

              <AnimatePresence>
                {showModeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 top-full mt-1 z-50 border rounded-xl shadow-2xl overflow-hidden min-w-[160px] ${theme === 'dark' ? 'bg-[#1a1f2e] border-white/12' : 'bg-white border-black/10'}`}
                  >
                    {(['hybrid', 'gemini', 'synthetic'] as TTSMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => handleModeSelect(m)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${ttsMode === m
                          ? (theme === 'dark' ? 'bg-blue-primary/15 text-blue-light' : 'bg-blue-50 text-blue-600')
                          : (theme === 'dark' ? 'text-white/50 hover:bg-white/5 hover:text-white/70' : 'text-black/50 hover:bg-black/5 hover:text-black/70')
                          }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                          background: ttsMode === m ? (theme === 'dark' ? '#60a5fa' : '#2563eb') : 'transparent',
                          border: ttsMode === m ? 'none' : (theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)'),
                        }} />
                        <div>
                          <div className="font-medium">{MODE_LABELS[m]}</div>
                          <div className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-white/25' : 'text-black/40'}`}>
                            {m === 'hybrid' && 'Gemini + fallback browser'}
                            {m === 'gemini' && 'Suara natural Gemini AI'}
                            {m === 'synthetic' && 'Suara browser (instant)'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Auto TTS toggle */}
            <motion.button
              onClick={() => {
                setAutoTTS((prev) => !prev);
                if (autoTTS) stopTTS();
              }}
              whileTap={{ scale: 0.92 }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${autoTTS
                ? (theme === 'dark' ? 'bg-blue-primary/10 border-blue-primary/25 text-blue-light' : 'bg-blue-100 border-blue-300 text-blue-600')
                : (theme === 'dark' ? 'bg-white/4 border-white/10 text-white/30 hover:text-white/50' : 'bg-black/4 border-black/10 text-black/40 hover:text-black/60')
                }`}
              title={autoTTS ? 'Auto-play suara aktif' : 'Auto-play suara nonaktif'}
            >
              {autoTTS ? (
                <IconVolume size={11} strokeWidth={2} />
              ) : (
                <IconVolumeOff size={11} strokeWidth={2} />
              )}
              <span className="text-[11px] font-medium">
                {autoTTS ? 'ON' : 'OFF'}
              </span>
            </motion.button>

            {activeDocs > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20"
              >
                <IconDocument size={11} strokeWidth={2} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">{activeDocs} Dokumen</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Click outside to close mode menu */}
        {showModeMenu && (
          <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  ttsStatus={ttsStatus}
                  isThisTTSPlaying={playingMessageId === msg.id}
                  onPlayTTS={handlePlayTTS}
                />
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {isTyping && <TypingIndicator />}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <MessageInput
          onSend={handleSend}
          onStop={handleStop}
          disabled={isDisabled}
          isGenerating={!!abortController}
        />
      </div>

      {/* Right: Voice Visualizer panel (sidebar - shown when NOT playing) */}
      <div className={`hidden lg:flex w-[340px] border-l flex-shrink-0 ${theme === 'dark' ? 'border-white/6 bg-navy-dark/20' : 'border-black/5 bg-gray-50/50'}`}>
        <VoiceVisualizer
          status={ttsStatus}
          mode={ttsMode}
          analyserRef={analyserRef}
        />
      </div>

      {/* Fullscreen AI Overlay — appears when TTS is speaking */}
      <AnimatePresence>
        {ttsStatus === 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
            style={{ background: theme === 'dark' ? 'radial-gradient(ellipse at center, rgba(15, 22, 40, 0.97) 0%, rgba(8, 12, 24, 0.99) 100%)' : 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.97) 0%, rgba(240, 240, 245, 0.99) 100%)' }}
          >
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 4 + i * 2,
                    height: 4 + i * 2,
                    background: theme === 'dark' ? `rgba(255, 140, 66, ${0.08 + i * 0.02})` : `rgba(255, 107, 0, ${0.08 + i * 0.02})`,
                    left: `${15 + i * 14}%`,
                    top: `${20 + (i % 3) * 25}%`,
                  }}
                  animate={{
                    y: [0, -30, 0],
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Character */}
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <VoiceVisualizer
                status={ttsStatus}
                mode={ttsMode}
                analyserRef={analyserRef}
                isFullscreen
              />
            </motion.div>


            {/* Stop button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3 }}
              onClick={() => stopTTS()}
              whileTap={{ scale: 0.95 }}
              className={`mt-6 flex items-center gap-2 px-6 py-3 rounded-full border transition-all backdrop-blur-sm cursor-pointer ${theme === 'dark' ? 'bg-white/8 border-white/15 text-white/60 hover:text-white hover:bg-white/12 hover:border-white/25' : 'bg-black/5 border-black/10 text-black/60 hover:text-black hover:bg-black/10 hover:border-black/20'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="2" />
              </svg>
              <span className="text-sm font-medium tracking-wide">Hentikan</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
