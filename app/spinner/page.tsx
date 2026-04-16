'use client';

import { motion } from 'framer-motion';
import { IconSpinner, IconPerson, IconPalette, IconZap } from '@/components/ui/Icons';

export default function SpinnerPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-black text-white mt-12 mb-4">
            Perjalanan di{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-primary to-orange-light">
              Hacktiv8
            </span>
          </h1>
          <p className="text-white/45 text-lg max-w-xl mx-auto leading-relaxed">
            Setiap individu memiliki cerita yang berbeda
          </p>
        </motion.div>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="inline-flex flex-col items-center gap-4 px-10 py-8 rounded-3xl bg-white/2 border border-white/8">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              >
                <IconZap size={24} strokeWidth={1.5} className="text-orange-primary/70" />
              </motion.div>
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center mb-2">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-orange-primary"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs font-semibold text-orange-primary uppercase tracking-widest">
                  Coming Soon
                </span>
              </div>
              <p className="text-white/35 text-sm">
                Spinner interaktif sedang dalam pengembangan
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
