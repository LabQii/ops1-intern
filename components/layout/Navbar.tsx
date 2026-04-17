'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { IconChat, IconSpinner, IconVideo, IconX, IconMenu, IconSun, IconMoon } from '@/components/ui/Icons';
import { useTheme } from '@/components/providers/ThemeProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Chat AI', icon: IconChat },
  { href: '/spinner', label: 'Spinner Cerita', icon: IconSpinner },
  { href: '/video', label: 'Video Rekap', icon: IconVideo },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const { theme } = useTheme();
  
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md transition-colors duration-300 border-b ${
      theme === 'dark' 
        ? 'bg-navy-dark/90 border-white/10' 
        : 'bg-white/90 border-black/5 shadow-sm'
    }`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 group font-sans">
          <span
            className="text-xl font-bold text-orange-primary tracking-tight group-hover:text-orange-light transition-colors"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          >
            OPS-1
          </span>
          <span
            className="text-xl font-bold text-blue-light tracking-wide uppercase"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}
          >
            INTERN
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1 relative">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                  isActive 
                    ? (theme === 'dark' ? 'text-orange-primary' : 'text-orange-primary') 
                    : (theme === 'dark' ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black')
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-bg"
                    className="absolute inset-0 rounded-lg bg-orange-primary/10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-4 right-4 h-0.5 bg-orange-primary rounded-full"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Desktop Theme Toggle */}
        <div className={`hidden md:flex items-center ml-2 border-l pl-4 transition-colors ${
          theme === 'dark' ? 'border-white/10' : 'border-black/10'
        }`}>
          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <button
          className={`md:hidden w-10 h-10 flex items-center justify-center transition-colors ${
            theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-black/70 hover:text-black'
          }`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <AnimatePresence mode="wait">
            {menuOpen ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <IconX size={20} strokeWidth={2} />
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <IconMenu size={20} strokeWidth={2} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className={`md:hidden fixed top-16 left-0 bottom-0 w-72 border-r p-6 flex flex-col gap-2 transition-colors ${
              theme === 'dark' ? 'bg-navy-dark border-white/10' : 'bg-white border-black/5 shadow-xl'
            }`}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl text-base font-medium transition-all ${
                    isActive
                      ? (theme === 'dark' 
                          ? 'bg-orange-primary/15 text-orange-primary border border-orange-primary/30' 
                          : 'bg-orange-primary/10 text-orange-primary border border-orange-primary/20')
                      : (theme === 'dark' 
                          ? 'text-white/60 hover:text-white hover:bg-white/5' 
                          : 'text-black/60 hover:text-black hover:bg-black/5')
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
            
            <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-black/10'}`}>
              <div className="flex items-center justify-between px-4 py-3">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white/60' : 'text-black/60'}`}>Tampilan</span>
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all border group overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/5 hover:bg-white/10 border-white/10' 
          : 'bg-black/5 hover:bg-black/10 border-black/10 shadow-sm'
      }`}
      aria-label="Ganti Tema"
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === 'dark' ? (
          <motion.div
            key="sun"
            initial={{ y: 20, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="text-orange-primary"
          >
            <IconSun size={20} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ y: 20, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="text-blue-light"
          >
            <IconMoon size={20} />
          </motion.div>
        )
        }
      </AnimatePresence>

      {/* Ambient glow effect */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity blur-xl rounded-full ${theme === 'dark' ? 'bg-orange-primary' : 'bg-blue-light'}`} />
    </button>
  );
}
