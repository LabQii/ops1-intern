'use client';

import { useRef, useState, KeyboardEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconUpload, IconSend } from '@/components/ui/Icons';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = '';
    }
  };

  const canSend = value.trim() && !disabled;

  return (
    <div className="border-t border-white/8 bg-navy-dark/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3 bg-white/4 border border-white/8 rounded-2xl px-3 py-2 focus-within:border-blue-primary/40 transition-all">

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Mulai bercerita tentang perjalananmu..."
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-white/25 text-sm resize-none outline-none py-1.5 min-h-[36px] max-h-[160px] leading-relaxed ml-2"
          />

          {/* Char counter */}
          {value.length > 200 && (
            <span className="text-[11px] text-white/25 mb-1.5 flex-shrink-0 font-mono">
              {value.length}
            </span>
          )}

          {/* Send button */}
          <motion.button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            whileTap={{ scale: 0.88 }}
            whileHover={canSend ? { scale: 1.05 } : {}}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mb-1 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            style={{
              background: canSend
                ? 'linear-gradient(135deg, #FF6B00, #FF9A3C)'
                : 'rgba(255,255,255,0.06)',
            }}
          >
            <IconSend size={15} strokeWidth={2} className="text-white" />
          </motion.button>
        </div>

        <p className="text-center text-[10px] text-white/18 mt-2 tracking-wide">
          Enter untuk kirim · Shift+Enter untuk baris baru
        </p>
      </div>
    </div>
  );
}
