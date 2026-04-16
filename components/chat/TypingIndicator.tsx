'use client';

import { motion } from 'framer-motion';
import { IconBot } from '@/components/ui/Icons';

export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 max-w-2xl">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-primary to-blue-light flex items-center justify-center flex-shrink-0">
        <IconBot size={16} strokeWidth={1.5} className="text-white" />
      </div>

      {/* Bubble */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-5 py-4"
      >
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-blue-light/70"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
