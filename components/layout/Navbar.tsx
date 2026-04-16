'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { IconChat, IconSpinner, IconVideo, IconX, IconMenu } from '@/components/ui/Icons';

const NAV_ITEMS = [
  { href: '/', label: 'Chat AI', icon: IconChat },
  { href: '/spinner', label: 'Spinner Cerita', icon: IconSpinner },
  { href: '/video', label: 'Video Rekap', icon: IconVideo },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-dark/90 backdrop-blur-md border-b border-white/10">
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
                  className="relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
                  style={{ color: isActive ? '#FF6B00' : 'rgba(255,255,255,0.6)' }}
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

          {/* Mobile: Simple Branding Only at Top */}
          <div className="md:hidden flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </nav>

      {/* Bottom Navigation for Mobile */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm">
        <div className="bg-[#111827]/80 backdrop-blur-2xl border border-white/12 rounded-[24px] p-2 flex items-center justify-around shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] group">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-1.5 p-2.5 px-5 rounded-2xl transition-all duration-500 min-w-[80px]"
              >
                <div 
                  className={`transition-all duration-500 transform ${isActive ? 'text-orange-primary scale-110' : 'text-white/30 group-hover:text-white/40'}`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
                <span className={`text-[10px] font-black tracking-[0.1em] transition-all duration-500 uppercase ${isActive ? 'text-orange-primary' : 'text-white/20'}`}>
                  {item.label.split(' ')[0]} 
                </span>
                
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active-pill"
                    className="absolute inset-0 bg-white/5 rounded-2xl -z-10"
                    initial={false}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
