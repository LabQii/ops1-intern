import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/layout/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'OPS-1 INTERN',
  description: 'Platform AI storytelling untuk merekam perjalanan 6 bulan penuh makna bersama Arifin & Hanifah.',
  openGraph: {
    title: 'OPS-1 INTERN',
    description: 'AI storytelling platform — ceritakan perjalananmu.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable} data-scroll-behavior="smooth">
      <body className="bg-navy-dark text-white antialiased">
        <Navbar />
        <main className="pb-24 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
