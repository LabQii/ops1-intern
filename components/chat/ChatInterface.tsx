'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, ToastMessage } from '@/types';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import Toast from '@/components/ui/Toast';
import { IconDocument, IconBot } from '@/components/ui/Icons';

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
  const bottomRef = useRef<HTMLDivElement>(null);

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
              <ChatBubble key={msg.id} message={msg} />
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
