'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { IconUser, IconCheck, IconSettings } from '@/components/ui/Icons';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push('/admin');
        router.refresh(); // clear cached layouts
      } else {
        const data = await res.json();
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md"
      >
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-primary to-blue-light flex items-center justify-center">
            <IconSettings size={24} className="text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-white mb-2">Admin Panel</h1>
        <p className="text-center text-white/50 text-sm mb-8">Login to manage documents</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-navy-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-blue-primary transition-colors"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-navy-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-blue-primary transition-colors"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm py-1.5 px-3 bg-red-400/10 rounded-lg border border-red-400/20 text-center">
              {error}
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
            type="submit"
            className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-blue-primary to-blue-light text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
            {!isLoading && <IconCheck size={18} strokeWidth={2} />}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
