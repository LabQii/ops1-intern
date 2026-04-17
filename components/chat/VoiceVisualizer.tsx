'use client';

import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TTSStatus, TTSMode } from '@/lib/hooks/useTTS';

interface VoiceVisualizerProps {
  status: TTSStatus;
  mode: TTSMode;
  analyserRef: React.RefObject<AnalyserNode | null>;
  isFullscreen?: boolean;
}

export default function VoiceVisualizer({ status, mode, analyserRef, isFullscreen = false }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const smoothAmpRef = useRef(0);
  const blinkRef = useRef({ timer: 0, isBlinking: false, nextBlink: 120 });
  const bounceRef = useRef(0);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Load the logo image once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      logoRef.current = img;
      setLogoLoaded(true);
    };
    img.src = '/logo.png';
  }, []);

  const canvasW = isFullscreen ? 500 : 300;
  const canvasH = isFullscreen ? 600 : 380;
  const scale = isFullscreen ? 1.65 : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);

    const cx = canvasW / 2;
    const cy = canvasH / 2 + 15;

    // ── Color palette (warm orange-white) ──
    const C = {
      bodyTop: '#FFF5ED',
      bodyMid: '#FFE4CC',
      bodyBot: '#FFD0A8',
      accent: '#FF8C42',
      accentLight: '#FFAD70',
      accentDark: '#E06B1A',
      white: '#FFFFFF',
      eyeDark: '#3D2B1F',
      mouthDark: '#5C3A21',
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvasW, canvasH);
      phaseRef.current += 0.025;

      const isPlaying = status === 'playing';
      const isLoading = status === 'loading';

      // ── Amplitude ──
      let targetAmp = 0;
      if (isPlaying && analyserRef.current) {
        const buf = analyserRef.current.frequencyBinCount;
        const data = new Uint8Array(buf);
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        const n = Math.min(buf, 128);
        for (let i = 0; i < n; i++) sum += data[i];
        targetAmp = sum / (n * 255);
      } else if (isPlaying) {
        targetAmp = 0.25 + 0.22 * Math.sin(phaseRef.current * 3) + 0.12 * Math.sin(phaseRef.current * 7.3);
      } else if (isLoading) {
        targetAmp = 0.06 + 0.05 * Math.sin(phaseRef.current * 2);
      }
      smoothAmpRef.current += (targetAmp - smoothAmpRef.current) * 0.2;
      const amp = smoothAmpRef.current;

      // ── Blink ──
      const blink = blinkRef.current;
      blink.timer++;
      if (blink.timer >= blink.nextBlink) {
        blink.isBlinking = true;
        if (blink.timer >= blink.nextBlink + 7) {
          blink.isBlinking = false;
          blink.timer = 0;
          blink.nextBlink = 80 + Math.random() * 160;
        }
      }

      // ── Bounce & Float ──
      bounceRef.current += isPlaying ? 0.08 : 0.03;
      const floatY = Math.sin(bounceRef.current) * (isPlaying ? 6 : 3) * scale;
      const squish = isPlaying ? 1 + amp * 0.04 : 1;
      const squishY = isPlaying ? 1 - amp * 0.03 : 1;

      ctx.save();
      ctx.translate(cx, cy + floatY);
      ctx.scale(squish * scale, squishY * scale);
      ctx.translate(-cx, -(cy + floatY));

      // ═══════════════════════════
      //  SOUND WAVE RINGS
      // ═══════════════════════════
      if (isPlaying && amp > 0.04) {
        for (let r = 0; r < 4; r++) {
          const rp = (phaseRef.current * 2 + r * 1.6) % (Math.PI * 2);
          const prog = rp / (Math.PI * 2);
          const radius = 85 + prog * 65;
          const alpha = (1 - prog) * amp * 0.3;
          ctx.strokeStyle = `rgba(255, 140, 66, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy + floatY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // ═══════════════════════════
      //  FLOOR SHADOW
      // ═══════════════════════════
      const shadowScale = 1 + amp * 0.15;
      const shGrad = ctx.createRadialGradient(cx, cy + 115 + floatY, 0, cx, cy + 115 + floatY, 65 * shadowScale);
      shGrad.addColorStop(0, 'rgba(180, 120, 60, 0.15)');
      shGrad.addColorStop(1, 'rgba(180, 120, 60, 0)');
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 115 + floatY, 65 * shadowScale, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // ═══════════════════════════
      //  BODY (tall to hold logo)
      // ═══════════════════════════
      const bodyTopW = 62;
      const bodyBotW = 82;
      const bodyTopY = cy + 34 + floatY;
      const bodyBotY = cy + 105 + floatY;

      ctx.save();
      ctx.shadowColor = 'rgba(200, 130, 60, 0.2)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      const bodyGr = ctx.createLinearGradient(cx, bodyTopY, cx, bodyBotY);
      bodyGr.addColorStop(0, C.bodyMid);
      bodyGr.addColorStop(1, C.bodyBot);
      ctx.fillStyle = bodyGr;
      ctx.beginPath();
      ctx.moveTo(cx - bodyTopW / 2, bodyTopY);
      ctx.lineTo(cx - bodyBotW / 2, bodyBotY - 14);
      ctx.quadraticCurveTo(cx, bodyBotY + 8, cx + bodyBotW / 2, bodyBotY - 14);
      ctx.lineTo(cx + bodyTopW / 2, bodyTopY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Body border
      ctx.strokeStyle = `rgba(255, 180, 120, 0.15)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - bodyTopW / 2, bodyTopY);
      ctx.lineTo(cx - bodyBotW / 2, bodyBotY - 14);
      ctx.quadraticCurveTo(cx, bodyBotY + 8, cx + bodyBotW / 2, bodyBotY - 14);
      ctx.lineTo(cx + bodyTopW / 2, bodyTopY);
      ctx.closePath();
      ctx.stroke();

      // Logo badge on body center (pushed down for gap from head)
      const logoCenterY = (bodyTopY + bodyBotY) / 2 + 6;
      const logoRadius = 16;

      if (logoRef.current) {
        // White circle background
        ctx.save();
        ctx.shadowColor = 'rgba(200, 130, 60, 0.2)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = C.white;
        ctx.beginPath();
        ctx.arc(cx, logoCenterY, logoRadius + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Orange border ring
        ctx.strokeStyle = `rgba(255, 140, 66, ${0.4 + (isPlaying ? amp * 0.4 : 0)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, logoCenterY, logoRadius + 3, 0, Math.PI * 2);
        ctx.stroke();

        // Outer glow when playing
        if (isPlaying) {
          const logoGlow = ctx.createRadialGradient(cx, logoCenterY, logoRadius, cx, logoCenterY, logoRadius + 14);
          logoGlow.addColorStop(0, `rgba(255, 140, 66, ${amp * 0.2})`);
          logoGlow.addColorStop(1, 'rgba(255, 140, 66, 0)');
          ctx.fillStyle = logoGlow;
          ctx.beginPath();
          ctx.arc(cx, logoCenterY, logoRadius + 14, 0, Math.PI * 2);
          ctx.fill();
        }

        // Clip to circle and draw logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, logoCenterY, logoRadius + 1, 0, Math.PI * 2);
        ctx.clip();
        const logoDrawSize = (logoRadius + 1) * 2;
        ctx.drawImage(logoRef.current, cx - logoDrawSize / 2, logoCenterY - logoDrawSize / 2, logoDrawSize, logoDrawSize);
        ctx.restore();
      } else {
        // Fallback orange badge if logo not loaded
        ctx.fillStyle = C.accent;
        ctx.beginPath();
        ctx.arc(cx, logoCenterY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.white;
        ctx.beginPath();
        ctx.arc(cx, logoCenterY, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // ═══════════════════════════
      //  HEAD
      // ═══════════════════════════
      const headW = 120;
      const headH = 100;
      const headX = cx - headW / 2;
      const headY = cy - headH / 2 + floatY - 8;
      const headR = 40;

      ctx.save();
      ctx.shadowColor = 'rgba(200, 130, 60, 0.25)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 8;
      const hGrad = ctx.createLinearGradient(headX, headY, headX, headY + headH);
      hGrad.addColorStop(0, C.bodyTop);
      hGrad.addColorStop(0.4, C.bodyMid);
      hGrad.addColorStop(1, C.bodyBot);
      ctx.fillStyle = hGrad;
      ctx.beginPath();
      ctx.roundRect(headX, headY, headW, headH, headR);
      ctx.fill();
      ctx.restore();

      // Head border
      const rimAlpha = isPlaying ? 0.5 + amp * 0.3 : 0.2;
      ctx.strokeStyle = `rgba(255, 140, 66, ${rimAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(headX, headY, headW, headH, headR);
      ctx.stroke();

      // Top 3D highlight
      const topShine = ctx.createLinearGradient(headX + 15, headY, headX + headW * 0.65, headY + headH * 0.3);
      topShine.addColorStop(0, 'rgba(255,255,255,0.55)');
      topShine.addColorStop(0.5, 'rgba(255,255,255,0.15)');
      topShine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = topShine;
      ctx.beginPath();
      ctx.roundRect(headX + 4, headY + 4, headW - 8, headH * 0.35, [headR - 3, headR - 3, 0, 0]);
      ctx.fill();

      // Bottom 3D shadow
      const botDark = ctx.createLinearGradient(headX, headY + headH * 0.65, headX, headY + headH);
      botDark.addColorStop(0, 'rgba(180, 120, 60, 0)');
      botDark.addColorStop(1, 'rgba(180, 120, 60, 0.1)');
      ctx.fillStyle = botDark;
      ctx.beginPath();
      ctx.roundRect(headX, headY, headW, headH, headR);
      ctx.fill();

      // (Logo is now on the body, not the forehead)

      // ═══════════════════════════
      //  EARS
      // ═══════════════════════════
      const earR = 14;
      const earY = headY + headH * 0.4;
      [headX - 4, headX + headW + 4].forEach((ex, i) => {
        const exx = i === 0 ? ex - earR * 0.3 : ex + earR * 0.3;
        ctx.save();
        ctx.shadowColor = 'rgba(200, 130, 60, 0.15)';
        ctx.shadowBlur = 6;
        const earGrad = ctx.createRadialGradient(exx + (i === 0 ? 3 : -3), earY - 3, 1, exx, earY, earR);
        earGrad.addColorStop(0, '#FFD4A8');
        earGrad.addColorStop(0.5, C.accentLight);
        earGrad.addColorStop(1, C.accent);
        ctx.fillStyle = earGrad;
        ctx.beginPath();
        ctx.arc(exx, earY, earR, 0, Math.PI * 2);
        ctx.fill();
        const innerGrad = ctx.createRadialGradient(exx + (i === 0 ? 2 : -2), earY - 1, 0, exx, earY, earR * 0.6);
        innerGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
        innerGrad.addColorStop(1, 'rgba(255,200,150,0.3)');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(exx, earY + 1, earR * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ═══════════════════════════
      //  ANTENNA
      // ═══════════════════════════
      const antBaseY = headY + 6;
      const antTipY = headY - 28;
      const antSway = Math.sin(phaseRef.current * 1.4) * 6;

      const stickGr = ctx.createLinearGradient(cx - 2, antBaseY, cx + 2, antBaseY);
      stickGr.addColorStop(0, C.accentLight);
      stickGr.addColorStop(0.5, C.accent);
      stickGr.addColorStop(1, C.accentDark);
      ctx.strokeStyle = stickGr;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, antBaseY);
      ctx.quadraticCurveTo(cx + antSway * 0.7, antTipY + 14, cx + antSway, antTipY);
      ctx.stroke();

      // Antenna ball
      const ballX = cx + antSway;
      const ballR2 = 9;
      const ballGlow = isPlaying ? 1.0 : 0.6 + 0.15 * Math.sin(phaseRef.current * 2.5);

      if (isPlaying) {
        const aura = ctx.createRadialGradient(ballX, antTipY, 3, ballX, antTipY, 22);
        aura.addColorStop(0, `rgba(255, 140, 66, ${0.25 + amp * 0.35})`);
        aura.addColorStop(1, 'rgba(255, 140, 66, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(ballX, antTipY, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      const bGrad = ctx.createRadialGradient(ballX - 2, antTipY - 3, 1, ballX, antTipY, ballR2);
      bGrad.addColorStop(0, `rgba(255, 220, 180, ${ballGlow})`);
      bGrad.addColorStop(0.4, `rgba(255, 160, 80, ${ballGlow})`);
      bGrad.addColorStop(1, `rgba(220, 100, 30, ${ballGlow * 0.8})`);
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(ballX, antTipY, ballR2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255,255,255, ${0.6 * ballGlow})`;
      ctx.beginPath();
      ctx.arc(ballX - 2.5, antTipY - 3, 3, 0, Math.PI * 2);
      ctx.fill();

      // ═══════════════════════════
      //  EYES
      // ═══════════════════════════
      const eyeY = headY + headH * 0.42;
      const eyeSpacing = 24;
      const lx = cx - eyeSpacing;
      const rx = cx + eyeSpacing;

      [lx, rx].forEach((ex) => {
        if (blink.isBlinking) {
          ctx.strokeStyle = C.eyeDark;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(ex, eyeY, 7, 0.1 * Math.PI, 0.9 * Math.PI, false);
          ctx.stroke();
        } else {
          // Eye white
          ctx.fillStyle = C.white;
          ctx.beginPath();
          ctx.ellipse(ex, eyeY, 12, 13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(180, 130, 80, 0.2)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(ex, eyeY, 12, 13, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Iris
          const irisGrad = ctx.createRadialGradient(ex, eyeY + 1, 1, ex, eyeY + 1, 8);
          irisGrad.addColorStop(0, '#5A3510');
          irisGrad.addColorStop(0.5, C.eyeDark);
          irisGrad.addColorStop(1, '#2A1508');
          ctx.fillStyle = irisGrad;
          ctx.beginPath();
          ctx.arc(ex, eyeY + 1, 7.5, 0, Math.PI * 2);
          ctx.fill();

          // Pupil
          ctx.fillStyle = '#0D0804';
          ctx.beginPath();
          ctx.arc(ex, eyeY + 1, 4, 0, Math.PI * 2);
          ctx.fill();

          // Highlights
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath();
          ctx.arc(ex + 3, eyeY - 3, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(ex - 2, eyeY + 3, 1.8, 0, Math.PI * 2);
          ctx.fill();

          // Bottom eyelid shadow
          ctx.fillStyle = 'rgba(180, 120, 60, 0.06)';
          ctx.beginPath();
          ctx.ellipse(ex, eyeY + 6, 10, 5, 0, 0, Math.PI);
          ctx.fill();
        }
      });

      // Eyebrows
      const browLift = isPlaying ? -2 - amp * 3 : 0;
      [lx, rx].forEach((ex, i) => {
        ctx.strokeStyle = 'rgba(180, 120, 60, 0.35)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const bDir = i === 0 ? 1 : -1;
        ctx.moveTo(ex - 8 * bDir, eyeY - 17 + browLift);
        ctx.quadraticCurveTo(ex, eyeY - 22 + browLift, ex + 8 * bDir, eyeY - 16 + browLift);
        ctx.stroke();
      });

      // ═══════════════════════════
      //  CHEEKS
      // ═══════════════════════════
      const cheekAlpha = 0.15 + (isPlaying ? amp * 0.25 : 0);
      [cx - 42, cx + 42].forEach((chx) => {
        const chGrad = ctx.createRadialGradient(chx, eyeY + 14, 0, chx, eyeY + 14, 14);
        chGrad.addColorStop(0, `rgba(255, 150, 100, ${cheekAlpha})`);
        chGrad.addColorStop(1, 'rgba(255, 150, 100, 0)');
        ctx.fillStyle = chGrad;
        ctx.beginPath();
        ctx.ellipse(chx, eyeY + 14, 14, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // ═══════════════════════════
      //  NOSE
      // ═══════════════════════════
      ctx.fillStyle = 'rgba(200, 130, 70, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, eyeY + 18, 3, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // ═══════════════════════════
      //  MOUTH — Synced to audio!
      // ═══════════════════════════
      const mouthY = eyeY + 30;
      const mouthW = 22 + amp * 14;
      const mouthOpenH = amp * 26;

      if (isPlaying && amp > 0.03) {
        const openH = Math.max(5, mouthOpenH);
        ctx.save();
        ctx.shadowColor = 'rgba(60, 30, 10, 0.2)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        const mGrad = ctx.createRadialGradient(cx, mouthY, 1, cx, mouthY + openH * 0.15, openH + 6);
        mGrad.addColorStop(0, 'rgba(40, 18, 8, 0.92)');
        mGrad.addColorStop(0.5, 'rgba(90, 40, 15, 0.8)');
        mGrad.addColorStop(1, 'rgba(160, 70, 30, 0.4)');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + openH * 0.08, mouthW / 2, openH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = `rgba(180, 100, 50, ${0.3 + amp * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + openH * 0.08, mouthW / 2, openH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 200, 160, ${0.2 + amp * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + openH * 0.08, mouthW / 2 - 1, openH / 2 - 1, 0, Math.PI, Math.PI * 2);
        ctx.stroke();

        if (openH > 10) {
          const tGrad = ctx.createRadialGradient(cx, mouthY + openH * 0.22, 0, cx, mouthY + openH * 0.22, 10);
          tGrad.addColorStop(0, `rgba(255, 130, 100, ${0.35 + amp * 0.2})`);
          tGrad.addColorStop(1, `rgba(220, 90, 60, ${0.15 + amp * 0.1})`);
          ctx.fillStyle = tGrad;
          ctx.beginPath();
          ctx.ellipse(cx, mouthY + openH * 0.28, 8, 5, 0, 0, Math.PI);
          ctx.fill();
        }

        if (openH > 7) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + amp * 0.12})`;
          ctx.beginPath();
          ctx.ellipse(cx, mouthY - openH * 0.1, mouthW / 2 - 3, 2.5, 0, 0, Math.PI);
          ctx.fill();
        }
      } else if (isLoading) {
        const pR = 5.5 + 2.5 * Math.sin(phaseRef.current * 3);
        ctx.fillStyle = 'rgba(60, 30, 10, 0.7)';
        ctx.beginPath();
        ctx.arc(cx, mouthY, pR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(200, 130, 70, ${0.35 + 0.2 * Math.sin(phaseRef.current * 3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Idle: cute cat-mouth "w"
        ctx.strokeStyle = C.mouthDark;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 14, mouthY - 2);
        ctx.quadraticCurveTo(cx - 7, mouthY + 7, cx, mouthY);
        ctx.quadraticCurveTo(cx + 7, mouthY + 7, cx + 14, mouthY - 2);
        ctx.stroke();
      }

      // ═══════════════════════════
      //  ARMS
      // ═══════════════════════════
      const armWave = isPlaying ? Math.sin(phaseRef.current * 3) * 0.3 : 0;
      const armBaseY = cy + 55 + floatY;

      // Left arm
      ctx.save();
      ctx.translate(cx - bodyTopW / 2 - 2, armBaseY);
      ctx.rotate(-0.4 + armWave);
      ctx.strokeStyle = C.bodyBot;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-14, 15);
      ctx.stroke();
      const hg1 = ctx.createRadialGradient(-14, 15, 0, -14, 15, 5);
      hg1.addColorStop(0, C.bodyTop);
      hg1.addColorStop(1, C.bodyBot);
      ctx.fillStyle = hg1;
      ctx.beginPath();
      ctx.arc(-14, 15, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right arm
      ctx.save();
      ctx.translate(cx + bodyTopW / 2 + 2, armBaseY);
      ctx.rotate(0.4 - armWave);
      ctx.strokeStyle = C.bodyBot;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, 15);
      ctx.stroke();
      const hg2 = ctx.createRadialGradient(14, 15, 0, 14, 15, 5);
      hg2.addColorStop(0, C.bodyTop);
      hg2.addColorStop(1, C.bodyBot);
      ctx.fillStyle = hg2;
      ctx.beginPath();
      ctx.arc(14, 15, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore(); // end squish transform

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, analyserRef, canvasW, canvasH, scale, logoLoaded]);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full w-full p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: canvasW, height: canvasH }}
        />
      </motion.div>

      {/* Status label */}
      <div className="text-center space-y-1.5">
        <motion.p
          className={`font-bold tracking-[0.2em] uppercase ${isFullscreen ? 'text-base' : 'text-xs'}`}
          animate={{ opacity: isPlaying ? [0.6, 1, 0.6] : 1 }}
          transition={isPlaying ? { duration: 2, repeat: Infinity } : {}}
          style={{ color: isPlaying ? '#FF8C42' : 'rgba(255,255,255,0.3)' }}
        >
          {isPlaying
            ? 'Sedang Berbicara'
            : isLoading
            ? 'Memproses Suara...'
            : 'Menunggu AI'}
        </motion.p>
        <p className={`text-white/20 ${isFullscreen ? 'text-xs' : 'text-[10px]'}`}>
          {mode === 'gemini' ? '✦ Gemini AI Voice' : mode === 'synthetic' ? '◈ Browser Voice' : '◉ Hybrid Voice'}
        </p>
      </div>
    </div>
  );
}
