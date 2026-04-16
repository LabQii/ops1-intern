'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, ToastMessage } from '@/types';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import Toast from '@/components/ui/Toast';
import { IconDocument, IconBot, IconVolume, IconVolumeOff } from '@/components/ui/Icons';
import { useTTS } from '@/lib/hooks/useTTS';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `Halo! Saya adalah asisten anda, ada yang bisa saya bantu?`,
  timestamp: new Date(),
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeDocs, setActiveDocs] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [autoTTS, setAutoTTS] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastFinishedIdRef = useRef<string | null>(null);

  const { status: ttsStatus, playingMessageId, play: playTTS, stop: stopTTS } = useTTS();

  useEffect(() => {
    // Fetch available documents count
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

  // Auto-play TTS when an assistant message finishes streaming
  useEffect(() => {
    if (!autoTTS) return;

    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg &&
      lastMsg.role === 'assistant' &&
      lastMsg.id !== 'welcome' &&
      !lastMsg.isStreaming &&
      lastMsg.content &&
      lastMsg.id !== lastFinishedIdRef.current
    ) {
      lastFinishedIdRef.current = lastMsg.id;
      playTTS(lastMsg.content, lastMsg.id);
    }
  }, [messages, autoTTS, playTTS]);

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

    // Stop any playing TTS when user sends a new message
    stopTTS();

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const history = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
      });

      if (!res.ok) throw new Error('Request failed');

      const assistantId = generateId();
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
    } catch {
      setIsTyping(false);
      addToast('error', 'Gagal mendapatkan respons. Coba lagi.');
    }
  };

  const handlePlayTTS = useCallback(
    (text: string, messageId: string) => {
      playTTS(text, messageId);
    },
    [playTTS]
  );

  const isDisabled = isTyping;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] pt-16">
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/6 bg-navy-dark/40">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <IconBot size={13} strokeWidth={1.5} className="text-white/30" />
          <span className="text-xs text-white/35 tracking-wide">OPS-1 AI aktif</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto TTS toggle */}
          <motion.button
            onClick={() => {
              setAutoTTS((prev) => !prev);
              if (autoTTS) stopTTS();
            }}
            whileTap={{ scale: 0.92 }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
              autoTTS
                ? 'bg-blue-primary/10 border-blue-primary/25 text-blue-light'
                : 'bg-white/4 border-white/10 text-white/30 hover:text-white/50'
            }`}
            title={autoTTS ? 'Auto-play suara aktif' : 'Auto-play suara nonaktif'}
          >
            {autoTTS ? (
              <IconVolume size={11} strokeWidth={2} />
            ) : (
              <IconVolumeOff size={11} strokeWidth={2} />
            )}
            <span className="text-[11px] font-medium">
              {autoTTS ? 'Suara ON' : 'Suara OFF'}
            </span>
          </motion.button>

          {activeDocs > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20"
            >
              <IconDocument size={11} strokeWidth={2} className="text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">{activeDocs} Dokumen aktif</span>
            </motion.div>
          )}
        </div>
      </div>

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
        disabled={isDisabled}
      />
    </div>
  );
}
