'use client';

import { useRef, useState, KeyboardEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSend } from '@/components/ui/Icons';
import { useTheme } from '@/components/providers/ThemeProvider';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  isGenerating?: boolean;
}

export default function MessageInput({ onSend, onStop, disabled, isGenerating }: MessageInputProps) {
  const { theme } = useTheme();
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

  const canSend = value.trim() && !disabled;

  return (
    <div className={`border-t backdrop-blur-sm px-4 py-3 ${theme === 'dark' ? 'border-white/8 bg-navy-dark/80' : 'border-black/5 bg-white/90'}`}>
      <div className="max-w-3xl mx-auto">
        <div className={`flex items-end gap-3 rounded-2xl px-4 py-2.5 transition-all shadow-inner border ${theme === 'dark' ? 'bg-white/5 border-white/10 focus-within:border-blue-primary/50 focus-within:bg-white/10' : 'bg-white border-orange-primary/30 focus-within:border-orange-primary focus-within:bg-orange-50/20'}`}>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Tulis sesuatu..."
            rows={1}
            className={`flex-1 bg-transparent text-[15px] resize-none outline-none py-1.5 min-h-[38px] max-h-[160px] leading-relaxed ml-1 ${theme === 'dark' ? 'text-white placeholder-white/30' : 'text-black placeholder-black/40'}`}
          />

          {/* Char counter */}
          {value.length > 200 && (
            <span className={`text-[11px] mb-1.5 flex-shrink-0 font-mono ${theme === 'dark' ? 'text-white/25' : 'text-black/30'}`}>
              {value.length}
            </span>
          )}

          {/* Action button */}
          {isGenerating ? (
            <motion.button
              type="button"
              onClick={onStop}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-all shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
                border: theme === 'dark' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.5)',
              }}
              title="Hentikan respons"
            >
              <div className="w-3.5 h-3.5 bg-red-400 rounded-[3px]" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              whileTap={{ scale: 0.88 }}
              whileHover={canSend ? { scale: 1.05 } : {}}
              className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              style={{
                background: canSend
                  ? 'linear-gradient(135deg, #FF6B00, #FF9A3C)'
                  : (theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
                border: canSend ? 'none' : (theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'),
              }}
            >
              <IconSend size={16} strokeWidth={2} className="text-white ml-0.5" />
            </motion.button>
          )}
        </div>

        <p className={`text-center text-[10px] mt-2 tracking-wide ${theme === 'dark' ? 'text-white/18' : 'text-black/30'}`}>
          Enter untuk kirim · Shift+Enter untuk baris baru
        </p>
      </div>
    </div>
  );
}
