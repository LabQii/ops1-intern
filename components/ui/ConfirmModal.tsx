'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { IconTrash, IconX } from '@/components/ui/Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, isLoading = false }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={isLoading ? undefined : onCancel}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-[#0d1627] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center"
        >
          {/* Close button (top right) */}
          <button
            onClick={isLoading ? undefined : onCancel}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
          >
            <IconX size={20} strokeWidth={2} />
          </button>

          {/* Icon Header */}
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5 border border-red-500/20">
            <IconTrash size={28} className="text-red-400" strokeWidth={1.5} />
          </div>

          <h3 className="text-[19px] font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-white/60 mb-8 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-white/80 font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses
                </>
              ) : (
                'Hapus'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
