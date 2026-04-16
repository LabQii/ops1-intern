"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, FerrisWheel } from "lucide-react";

const SEGMENTS = [
  "Arifin",
  "Syam",
  "Regina",
  "David",
  "Iqbal",
  "Hanifah",
];

const COLORS = [
  "#ffe0cc", // very light orange
  "#ffbd90", // peach
  "#ff9e66", // darker orange
  "#ffe0cc",
  "#ffbd90",
  "#ff9e66",
];

export default function SpinnerGame() {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);

  const angle = 360 / SEGMENTS.length;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const lastSectorRef = useRef<number>(-1);
  const animationFrameIdRef = useRef<number>(0);

  // Initialize AudioContext on first user interaction
  const initAudio = () => {
    if (!audioCtxRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      } catch (e) { }
    }
  };

  const playTick = () => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.05);
    } catch (e) { }
  };

  const playTada = () => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const createNote = (freq: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.value = freq;

        gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

        oscillator.start(ctx.currentTime + startTime);
        oscillator.stop(ctx.currentTime + startTime + duration);
      };

      // C major arpeggio
      createNote(261.63, 0, 0.4);
      createNote(329.63, 0.1, 0.4);
      createNote(392.00, 0.2, 0.4);

      // Hold high C chord
      createNote(523.25, 0.4, 1.5);
      createNote(392.00, 0.4, 1.5);
      createNote(329.63, 0.4, 1.5);
      createNote(261.63, 0.4, 1.5);
    } catch (e) { }
  };

  const checkTick = useCallback(() => {
    if (!wheelRef.current) return;
    const st = window.getComputedStyle(wheelRef.current);
    const tr = st.getPropertyValue("transform");
    if (tr && tr !== 'none') {
      const values = tr.split('(')[1].split(')')[0].split(',');
      const a = parseFloat(values[0]);
      const b = parseFloat(values[1]);
      let angleDeg = Math.atan2(b, a) * (180 / Math.PI);
      if (angleDeg < 0) angleDeg += 360;

      const segmentAngle = 360 / SEGMENTS.length;
      let sector = Math.floor(angleDeg / segmentAngle);

      if (lastSectorRef.current !== -1 && sector !== lastSectorRef.current) {
        playTick();
      }
      lastSectorRef.current = sector;
    }

    animationFrameIdRef.current = requestAnimationFrame(checkTick);
  }, []);

  useEffect(() => {
    if (isSpinning) {
      lastSectorRef.current = -1;
      animationFrameIdRef.current = requestAnimationFrame(checkTick);
    } else {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    return () => cancelAnimationFrame(animationFrameIdRef.current);
  }, [isSpinning, checkTick]);

  const spinWheel = () => {
    if (isSpinning) return;
    initAudio();
    setIsSpinning(true);
    setResult(null);
    setIsLoadingMemory(false);

    // Give it random spins
    const spinDegrees = Math.floor(Math.random() * 360);
    const extraSpins = 360 * (5 + Math.floor(Math.random() * 3));
    const newRotation = rotation + extraSpins + spinDegrees;

    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      // Calculate which segment won based on the final rotation
      const normalizedRotation = (360 - (newRotation % 360)) % 360;
      const index = Math.round(normalizedRotation / angle) % SEGMENTS.length;

      setResult(SEGMENTS[index]);
      setIsLoadingMemory(true);

      // Simulate drawing the memory
      setTimeout(() => {
        setIsLoadingMemory(false);
        playTada();
      }, 2000);

    }, 5000); // Wait 5s for the CSS transition to end
  };

  // Generate the conic gradient for the wheel
  const conicGradient = SEGMENTS.map((_, i) => {
    return `${COLORS[i % COLORS.length]} ${i * angle}deg ${(i + 1) * angle}deg`;
  }).join(", ");

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap');
        
        * {
            font-family: 'Fredoka', sans-serif;
        }
        
        body {
            background: #fff9f5 !important;
            overflow-x: hidden;
        }

        .wheel-container {
            position: relative;
            width: 85vw;
            max-width: 450px;
            aspect-ratio: 1 / 1;
            margin: 0 auto;
            padding: 10px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 20px 0 #ffd8b8, 0 25px 50px -12px rgba(251, 146, 60, 0.25);
        }

        .wheel-inner {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 12px solid #fff;
            transition: transform 5s cubic-bezier(0.2, 0, 0.1, 1);
            overflow: hidden;
            box-shadow: inset 0 0 15px rgba(0,0,0,0.05);
        }

        .pointer {
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 50px;
            height: 50px;
            z-index: 20;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
        }

        .pointer-svg {
            fill: #ff8c42;
        }

        .modal-overlay {
            background: rgba(255, 137, 34, 0.2);
            backdrop-filter: blur(8px);
        }

        .cute-button {
            background: #ff8c42;
            border-bottom: 6px solid #e66b1a;
            transition: all 0.1s;
        }

        .cute-button:active {
            transform: translateY(4px);
            border-bottom-width: 2px;
        }

        .cute-button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: translateY(4px);
            border-bottom-width: 2px;
        }

        .loader {
            border: 6px solid #ffedd5;
            border-top: 6px solid #ff8c42;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .bouncy {
            animation: bounce 2s infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
      `}} />

      <div className="min-h-screen flex flex-col items-center p-4 pt-20">
        {/* Header */}
        <header className="text-center mb-10 mt-6 bouncy">
          <h1 className="text-5xl font-bold text-[#ff8c42] mb-2">Bye-Bye Memories!</h1>
          <p className="text-orange-400 font-medium">Let's find a sweet story to tell ✨</p>
        </header>

        {/* Game Area */}
        <div className="wheel-container">
          <div className="pointer">
            <svg viewBox="0 0 100 100" className="pointer-svg">
              <path d="M50 95 L20 10 L80 10 Z" />
              <circle cx="50" cy="20" r="15" fill="white" />
            </svg>
          </div>

          <div
            ref={wheelRef}
            className="wheel-inner"
            style={{
              transform: `rotate(${rotation}deg)`,
              background: `conic-gradient(from -${angle / 2}deg, ${conicGradient})`,
            }}
          >
            {SEGMENTS.map((segment, index) => {
              return (
                <div
                  key={index}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ transform: `rotate(${index * angle}deg)` }}
                >
                  <div className="pt-8 md:pt-12 font-bold text-lg md:text-2xl text-white tracking-wide text-center drop-shadow-[0_2px_4px_#ff8c42]">
                    {segment}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Logo Hub - Stationary! */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 md:w-32 md:h-32 bg-white rounded-full z-10 shadow-xl border-8 border-[#fde6d5] flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Office Logo" className="w-full h-full object-cover p-1 md:p-2" />
          </div>
        </div>

        <button
          onClick={spinWheel}
          disabled={isSpinning}
          className="mt-16 cursor-pointer cute-button text-white px-12 py-5 rounded-3xl font-bold text-2xl tracking-wide uppercase shadow-xl hover:brightness-110 mx-auto flex items-center justify-center gap-2"
        >
          {isSpinning ? "SPINNING..." : <span className="flex items-center gap-3">SPIN ME! <FerrisWheel className="w-8 h-8" /></span>}
        </button>

        {/* Story Modal */}
        {result && !isSpinning && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] max-w-lg w-full overflow-hidden shadow-2xl border-8 border-orange-50 transform transition-all animate-in zoom-in duration-300">

              {isLoadingMemory ? (
                <div className="p-16 flex flex-col items-center justify-center">
                  <div className="loader mb-6"></div>
                  <p className="text-orange-500 font-bold text-xl animate-pulse">Drawing your memory... 🎨</p>
                </div>
              ) : (
                <div>
                  <div className="relative p-6">
                    {/* Replaced Unsplash image with the Fox Logo! */}
                    <div className="bg-orange-50 rounded-[30px] border-4 border-orange-100 flex items-center justify-center w-full h-72 p-4">
                      <img
                        src="/logo.png"
                        alt="Fox Logo"
                        className="max-h-full object-contain"
                      />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff8c42] text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg whitespace-nowrap flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5 fill-current" /> <span>{result}</span> <Sparkles className="w-5 h-5 fill-current" />
                    </div>
                  </div>
                  <div className="p-8 text-center pt-10">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Tell the Story!</h2>
                    <p className="text-gray-500 font-medium mb-8">What adorable moment comes to mind when you see this?</p>
                    <button
                      onClick={() => setResult(null)}
                      className="w-full bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold py-4 rounded-2xl transition-all border-b-4 border-orange-200 active:translate-y-1 active:border-b-0"
                    >
                      That was sweet! One more?
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}
