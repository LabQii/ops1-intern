'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '@/types';
import { IconUser, IconBot } from '@/components/ui/Icons';

interface ChatBubbleProps {
  message: Message;
}

function renderContent(content: string) {
  const lines = content.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('• ') || line.startsWith('- ')) {
      return (
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-orange-primary mt-1 text-xs leading-relaxed">—</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return (
      <p
        key={i}
        className={line === '' ? 'h-2' : ''}
        dangerouslySetInnerHTML={{ __html: boldProcessed }}
      />
    );
  });
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  const timeStr = message.timestamp.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} max-w-2xl ${isUser ? 'ml-auto' : 'mr-auto'}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-gradient-to-br from-orange-primary to-orange-light'
            : 'bg-gradient-to-br from-blue-primary to-blue-light'
        }`}
      >
        {isUser
          ? <IconUser size={16} strokeWidth={2} className="text-white" />
          : <IconBot size={16} strokeWidth={1.5} className="text-white" />
        }
      </div>

      {/* Bubble */}
      <div className="group relative">
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-prose ${
            isUser
              ? 'bg-orange-primary/15 border border-orange-primary/25 text-white rounded-br-sm'
              : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-sm'
          }`}
        >
          <div className="flex flex-col gap-1">
            {renderContent(message.content)}
            {message.isStreaming && (
              <motion.span
                className="inline-block w-0.5 h-4 bg-blue-light ml-0.5 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            )}
          </div>
        </div>

        {/* Timestamp on hover */}
        <div
          className={`absolute top-full mt-1 text-[10px] text-white/25 opacity-0 group-hover:opacity-100 transition-opacity ${
            isUser ? 'right-0' : 'left-0'
          }`}
        >
          {timeStr}
        </div>
      </div>
    </motion.div>
  );
}
