'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { IconVideo, IconPlay, IconClock, IconCamera, IconMap } from '@/components/ui/Icons';

const STATS = [
  { label: 'Durasi', value: '~12 menit', Icon: IconClock },
  { label: 'Momen', value: '180+ foto', Icon: IconCamera },
  { label: 'Perjalanan', value: '6 bulan', Icon: IconMap },
];

export default function VideoPage() {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-black text-white mt-12 mb-4">
            THANKYOU{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-light to-blue-primary">
              ALL
            </span>
          </h1>
          <p className="text-white/45 text-lg max-w-xl mx-auto leading-relaxed">
            Terimakasih sudah bersama selama 6 bulan ini
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', bounce: 0.2 }}
          className="relative aspect-video rounded-3xl overflow-hidden border border-white/8 bg-gradient-to-br from-navy-dark via-navy-dark to-blue-primary/15 cursor-pointer mb-8 group"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Background concentric rings */}
          <div className="absolute inset-0 flex items-center justify-center opacity-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute border border-blue-light/40 rounded-full"
                style={{
                  width: `${(i + 1) * 12}%`,
                  height: `${(i + 1) * 12}%`,
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: hovered ? 1.1 : 1 }}
              transition={{ type: 'spring', bounce: 0.4, duration: 0.4 }}
              className="w-18 h-18 rounded-full bg-white/8 backdrop-blur-md border border-white/15 flex items-center justify-center"
              style={{ width: 72, height: 72 }}
            >
              <IconPlay size={28} className="text-white ml-1 opacity-80" />
            </motion.div>
          </div>

          <div className="absolute inset-0 backdrop-blur-[1px] bg-navy-dark/55 flex flex-col items-center justify-end pb-8">
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center mb-1.5">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-blue-light"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs font-semibold text-blue-light uppercase tracking-widest">
                  Coming Soon
                </span>
              </div>
              <p className="text-white/30 text-xs tracking-wide">Video sedang dalam proses editing</p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
