'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { IconVideo, IconPlay } from '@/components/ui/Icons';
import VideoModal from '@/components/ui/VideoModal';

interface RecapVideo {
  id: string;
  title: string;
  embed_url: string;
  thumbnail_url: string | null;
  created_at: string;
}



export default function VideoPage() {
  const [videos, setVideos] = useState<RecapVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<RecapVideo | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/videos')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setVideos(d.videos);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

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
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-blue-primary/30 border-t-blue-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Coming soon — no videos yet */}
        {!isLoading && videos.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', bounce: 0.2 }}
            className="relative aspect-video rounded-3xl overflow-hidden border border-white/8 bg-gradient-to-br from-navy-dark via-navy-dark to-blue-primary/15 mb-8"
          >
            {/* Background concentric rings */}
            <div className="absolute inset-0 flex items-center justify-center opacity-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute border border-blue-light/40 rounded-full"
                  style={{ width: `${(i + 1) * 12}%`, height: `${(i + 1) * 12}%` }}
                />
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[72px] h-[72px] rounded-full bg-white/8 backdrop-blur-md border border-white/15 flex items-center justify-center">
                <IconPlay size={28} className="text-white ml-1 opacity-80" />
              </div>
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
        )}

        {/* Video Grid */}
        {!isLoading && videos.length > 0 && (
          <div className="flex flex-col gap-6 mb-12">
            <AnimatePresence>
              {videos.map((video, i) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.08, type: 'spring', bounce: 0.2 }}
                  className="group relative rounded-2xl overflow-hidden border border-white/8 bg-gradient-to-br from-navy-dark to-blue-primary/10 cursor-pointer"
                  style={{ aspectRatio: '16/9' }}
                  onClick={() => setActiveVideo(video)}
                  onMouseEnter={() => setHoveredId(video.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Thumbnail */}
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute border border-blue-light/40 rounded-full"
                          style={{ width: `${(i + 1) * 15}%`, height: `${(i + 1) * 15}%` }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ scale: hoveredId === video.id ? 1.12 : 1 }}
                      transition={{ type: 'spring', bounce: 0.4, duration: 0.35 }}
                      className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl"
                    >
                      <IconPlay size={22} className="text-white ml-0.5" />
                    </motion.div>
                  </div>

                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-white font-semibold text-base leading-tight">{video.title}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={!!activeVideo}
        title={activeVideo?.title ?? ''}
        embedUrl={activeVideo?.embed_url ?? ''}
        onClose={() => setActiveVideo(null)}
      />
    </div>
  );
}
