'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { ToastMessage } from '@/types';
import { IconCheck, IconError, IconInfo } from '@/components/ui/Icons';

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const ICONS = {
  success: IconCheck,
  error: IconError,
  info: IconInfo,
};

const COLORS = {
  success: 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400',
  error: 'border-red-500/30 bg-red-500/8 text-red-400',
  info: 'border-blue-primary/30 bg-blue-primary/8 text-blue-light',
};

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <motion.div
      layout
      initial={{ x: 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 120, opacity: 0 }}
      transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm max-w-sm cursor-pointer ${COLORS[toast.type]}`}
      onClick={() => onRemove(toast.id)}
    >
      <Icon size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm text-white leading-snug">{toast.message}</p>
    </motion.div>
  );
}

export default function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}
