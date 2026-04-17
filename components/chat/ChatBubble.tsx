'use client';

import { motion } from 'framer-motion';
import { Message } from '@/types';
import { IconUser, IconBot, IconVolume, IconVolumeOff, IconLoader } from '@/components/ui/Icons';

interface ChatBubbleProps {
  message: Message;
  ttsStatus?: 'idle' | 'loading' | 'playing' | 'error';
  isThisTTSPlaying?: boolean;
  onPlayTTS?: (text: string, messageId: string) => void;
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

export default function ChatBubble({ message, ttsStatus = 'idle', isThisTTSPlaying = false, onPlayTTS }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  const timeStr = message.timestamp.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleTTSClick = () => {
    if (onPlayTTS && message.content) {
      onPlayTTS(message.content, message.id);
    }
  };

  // Determine the icon/state for TTS button
  const renderTTSButton = () => {
    if (isUser || message.isStreaming || !onPlayTTS) return null;

    const isLoading = isThisTTSPlaying && ttsStatus === 'loading';
    const isPlaying = isThisTTSPlaying && ttsStatus === 'playing';

    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
        onClick={handleTTSClick}
        disabled={isLoading}
        className={`
          w-7 h-7 rounded-lg flex items-center justify-center
          transition-all duration-200 flex-shrink-0
          ${isPlaying
            ? 'bg-blue-primary/20 border border-blue-primary/40 text-blue-light'
            : isLoading
              ? 'bg-white/5 border border-white/10 text-white/30 cursor-wait'
              : 'bg-white/5 border border-white/8 text-white/30 hover:text-white/60 hover:bg-white/10 hover:border-white/15'
          }
        `}
        title={isPlaying ? 'Stop audio' : 'Play audio'}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <IconLoader size={13} strokeWidth={2} />
          </motion.div>
        ) : isPlaying ? (
          <IconVolumeOff size={13} strokeWidth={2} />
        ) : (
          <IconVolume size={13} strokeWidth={2} />
        )}
      </motion.button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 ${
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

      {/* Bubble + TTS button container */}
      <div className={`flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-3 rounded-[20px] text-[15px] leading-relaxed w-fit shadow-md transition-all ${
            isUser
              ? 'bg-gradient-to-br from-orange-primary/20 to-orange-primary/10 border border-orange-primary/25 text-white rounded-br-none'
              : 'bg-gradient-to-br from-white/12 to-white/6 border border-white/12 text-white rounded-bl-none'
          }`}
        >
          <div className="flex flex-col gap-1 break-words">
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

        {/* TTS button + timestamp row */}
        <div className={`flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {renderTTSButton()}
          <div
            className="text-[11px] text-white/40 tracking-wide"
          >
            {timeStr}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
