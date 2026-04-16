'use client';

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TTSStatus, TTSMode } from '@/lib/hooks/useTTS';

interface VoiceVisualizerProps {
  status: TTSStatus;
  mode: TTSMode;
  analyserRef: React.RefObject<AnalyserNode | null>;
}

const BAR_COUNT = 48;

export default function VoiceVisualizer({ status, mode, analyserRef }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const innerRadius = size * 0.22;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      const isPlaying = status === 'playing';
      const isLoading = status === 'loading';

      // Amplitude values for bars
      let amplitudes: number[] = new Array(BAR_COUNT).fill(0);

      if (isPlaying && analyserRef.current) {
        // Real frequency data from Gemini AudioContext
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const step = Math.max(1, Math.floor(bufferLength / BAR_COUNT));
        for (let i = 0; i < BAR_COUNT; i++) {
          amplitudes[i] = dataArray[i * step] / 255;
        }
      } else if (isPlaying) {
        // Smooth sine-wave pattern for synthetic mode (not random)
        phaseRef.current += 0.06;
        for (let i = 0; i < BAR_COUNT; i++) {
          const angle = (i / BAR_COUNT) * Math.PI * 2;
          amplitudes[i] =
            0.15 +
            0.25 * Math.sin(angle * 3 + phaseRef.current) +
            0.15 * Math.sin(angle * 5 + phaseRef.current * 1.7) +
            0.1 * Math.sin(angle * 7 + phaseRef.current * 0.5);
          amplitudes[i] = Math.max(0.08, Math.min(1, amplitudes[i]));
        }
      } else if (isLoading) {
        // Subtle pulsing for loading
        phaseRef.current += 0.03;
        for (let i = 0; i < BAR_COUNT; i++) {
          const angle = (i / BAR_COUNT) * Math.PI * 2;
          amplitudes[i] = 0.05 + 0.08 * Math.sin(angle * 2 + phaseRef.current);
        }
      } else {
        // Idle: tiny uniform bars
        for (let i = 0; i < BAR_COUNT; i++) {
          amplitudes[i] = 0.03;
        }
      }

      // --- Draw outer soft glow ---
      if (isPlaying) {
        const avgAmp = amplitudes.reduce((a, b) => a + b, 0) / BAR_COUNT;
        const glowRadius = innerRadius + 60 + avgAmp * 40;
        const glow = ctx.createRadialGradient(
          centerX, centerY, innerRadius,
          centerX, centerY, glowRadius
        );
        glow.addColorStop(0, `rgba(59, 130, 246, ${0.06 + avgAmp * 0.08})`);
        glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Draw bars around circle ---
      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        const amp = amplitudes[i];
        const barLength = 6 + amp * 55;
        const barWidth = 2.5;

        const x1 = centerX + Math.cos(angle) * (innerRadius + 6);
        const y1 = centerY + Math.sin(angle) * (innerRadius + 6);
        const x2 = centerX + Math.cos(angle) * (innerRadius + 6 + barLength);
        const y2 = centerY + Math.sin(angle) * (innerRadius + 6 + barLength);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isPlaying
          ? `rgba(96, 165, 250, ${0.35 + amp * 0.65})`
          : `rgba(96, 165, 250, ${0.08 + amp * 0.2})`;
        ctx.lineWidth = barWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // --- Draw inner circle ---
      const innerGrad = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, innerRadius
      );
      if (isPlaying) {
        innerGrad.addColorStop(0, 'rgba(59, 130, 246, 0.18)');
        innerGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.08)');
        innerGrad.addColorStop(1, 'rgba(59, 130, 246, 0.04)');
      } else {
        innerGrad.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
        innerGrad.addColorStop(0.7, 'rgba(59, 130, 246, 0.03)');
        innerGrad.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
      }
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isPlaying
        ? 'rgba(96, 165, 250, 0.35)'
        : 'rgba(96, 165, 250, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();

      // --- Waveform icon inside circle ---
      const barHeights = [14, 22, 32, 22, 14];
      const barSpacing = 10;
      const totalW = barHeights.length * barSpacing;
      const startX = centerX - totalW / 2 + barSpacing / 2;

      barHeights.forEach((h, idx) => {
        const bh = isPlaying
          ? h * (0.5 + amplitudes[idx * 8] * 0.8)
          : isLoading
          ? h * (0.4 + 0.2 * Math.sin(phaseRef.current + idx * 0.5))
          : h * 0.3;
        const bx = startX + idx * barSpacing;

        ctx.fillStyle = isPlaying
          ? 'rgba(96, 165, 250, 0.6)'
          : 'rgba(96, 165, 250, 0.2)';
        ctx.beginPath();
        ctx.roundRect(bx - 1.5, centerY - bh / 2, 3, bh, 1.5);
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, analyserRef]);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';

  return (
    <div className="flex flex-col items-center justify-center gap-8 h-full w-full p-6">
      {/* Canvas visualizer */}
      <motion.div
        animate={isPlaying ? { scale: [1, 1.02, 1] } : isLoading ? { scale: [1, 1.01, 1] } : {}}
        transition={isPlaying ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 3, repeat: Infinity }}
      >
        <canvas
          ref={canvasRef}
          className="w-[300px] h-[300px]"
          style={{ width: 300, height: 300 }}
        />
      </motion.div>

      {/* Status label */}
      <div className="text-center space-y-1.5">
        <motion.p
          className="text-xs tracking-[0.2em] uppercase"
          animate={{ opacity: isPlaying ? [0.5, 1, 0.5] : 1 }}
          transition={isPlaying ? { duration: 2, repeat: Infinity } : {}}
          style={{ color: isPlaying ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.2)' }}
        >
          {isPlaying
            ? 'Sedang Berbicara'
            : isLoading
            ? 'Memproses Suara...'
            : 'Menunggu'}
        </motion.p>
        <p className="text-[10px] text-white/15">
          {mode === 'gemini' ? '✦ Gemini AI Voice' : mode === 'synthetic' ? '◈ Browser Voice' : '◉ Hybrid Voice'}
        </p>
      </div>
    </div>
  );
}
