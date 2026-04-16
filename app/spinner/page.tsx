"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, FerrisWheel, Maximize2, X } from "lucide-react";

const INITIAL_SEGMENTS = [
  "Arifin",
  "Syam",
  "Regina",
  "David",
  "Iqbal",
  "Ifah",
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
  const [sourceSegments, setSourceSegments] = useState(INITIAL_SEGMENTS);
  const [availableSegments, setAvailableSegments] = useState(INITIAL_SEGMENTS);
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);

  const angle = availableSegments.length > 0 ? 360 / availableSegments.length : 0;

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

      const segmentAngle = availableSegments.length > 0 ? 360 / availableSegments.length : 0;
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

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/spinner-photos');
        const data = await res.json();
        if (data.success && data.photos) {
          const names = Object.keys(data.photos);
          if (names.length > 0) {
            setSourceSegments(names);

            // Only set availableSegments to full list if NO matching saved list exists
            const saved = localStorage.getItem("spinner_available_names");
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Intersect with current names in case some were deleted from admin
                const validNames = parsed.filter(n => names.includes(n));
                setAvailableSegments(validNames.length > 0 ? validNames : names);
              } else {
                setAvailableSegments(names);
              }
            } else {
              setAvailableSegments(names);
            }
          }
          setPhotoMap(data.photos);
        }
      } catch (error) {
        console.error("Failed to fetch spinner photos:", error);
      } finally {
        setIsInitialLoading(false);
      }
    }
    fetchData();
  }, []);

  // Remove the old Load Persistence useEffect (merged above)


  // Save persistence on change
  useEffect(() => {
    // Only save if we are not in initial loading state and have segments
    if (!isInitialLoading) {
      if (availableSegments.length > 0) {
        localStorage.setItem("spinner_available_names", JSON.stringify(availableSegments));
      } else if (sourceSegments.length > 0) {
        // Only remove if we actually have source names (to avoid clearing on early renders)
        localStorage.removeItem("spinner_available_names");
      }
    }
  }, [availableSegments, isInitialLoading, sourceSegments.length]);

  // Idle Spin Effect
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    if (!isSpinning && !result) {
      const updateIdleSpin = (time: number) => {
        const deltaTime = time - lastTime;
        lastTime = time;
        // Advance rotation (e.g. 15 degrees per second)
        setRotation(r => r + (15 * deltaTime / 1000));
        animationId = requestAnimationFrame(updateIdleSpin);
      };
      animationId = requestAnimationFrame(updateIdleSpin);
    }
    return () => cancelAnimationFrame(animationId);
  }, [isSpinning, result]);

  const spinWheel = () => {
    if (isSpinning) return;
    initAudio();
    setIsSpinning(true);
    setResult(null);
    setIsLoadingMemory(false);

    // Provide a small delay so React applies .spinning class first
    setTimeout(() => {
      setRotation(prev => {
        const spinDegrees = Math.floor(Math.random() * 360);
        const extraSpins = 360 * (5 + Math.floor(Math.random() * 3));
        const newRotation = prev + extraSpins + spinDegrees;

        setTimeout(() => {
          setIsSpinning(false);
          const normalizedRotation = (360 - (newRotation % 360)) % 360;
          const index = Math.round(normalizedRotation / angle) % availableSegments.length;
          setResult(availableSegments[index]);
          setIsLoadingMemory(true);

          setTimeout(() => {
            setIsLoadingMemory(false);
            playTada();
          }, 2000);
        }, 5000); // the transition duration

        return newRotation;
      });
    }, 50);
  };

  // Generate the conic gradient for the wheel
  const conicGradient = availableSegments.map((_, i) => {
    return `${COLORS[i % COLORS.length]} ${i * angle}deg ${(i + 1) * angle}deg`;
  }).join(", ");

  const resetWheel = () => {
    if (isSpinning) return;
    setAvailableSegments(sourceSegments);
    localStorage.removeItem("spinner_available_names");
    setResult(null);
    setRotation(0);
    lastSectorRef.current = -1;
  };

  const handleNext = () => {
    if (result) {
      setAvailableSegments(prev => prev.filter(s => s !== result));
    }
    setResult(null);
    setIsImageEnlarged(false);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        * {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
        }
        
        body {
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
            overflow: hidden;
            box-shadow: inset 0 0 15px rgba(0,0,0,0.05);
        }

        .wheel-inner.spinning {
            transition: transform 5s cubic-bezier(0.2, 0, 0.1, 1);
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

        .enlarge-overlay {
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            z-index: 100;
        }
      `}} />

      <div className="min-h-screen flex flex-col items-center p-4 pt-20">
        {/* Header */}
        <header className="text-center mb-12 mt-6">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            GOODBYE{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-light to-orange-primary">
              MEMORIES
            </span>
          </h1>
          <p className="text-white/45 text-lg max-w-xl mx-auto leading-relaxed">
            Mari kita dengar cerita dari masing-masing individual
          </p>
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
            className={`wheel-inner ${isSpinning ? 'spinning' : ''}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              background: `conic-gradient(from -${angle / 2}deg, ${conicGradient})`,
            }}
          >
            {availableSegments.map((segment, index) => {
              return (
                <div
                  key={`${segment}-${index}`}
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

        <div className="mt-16 flex flex-col items-center gap-6">
          <button
            onClick={spinWheel}
            disabled={isSpinning || availableSegments.length === 0}
            className="cursor-pointer cute-button text-white px-12 py-5 rounded-3xl font-bold text-2xl tracking-wide uppercase shadow-xl hover:brightness-110 flex items-center justify-center gap-2"
          >
            {isSpinning
              ? "SPINNING..."
              : availableSegments.length === 0
                ? "DONE!"
                : <span className="flex items-center gap-3">SPIN ME! <FerrisWheel className="w-8 h-8" /></span>
            }
          </button>

          {availableSegments.length < sourceSegments.length && (
            <button
              onClick={resetWheel}
              disabled={isSpinning}
              className="text-white/60 hover:text-white text-sm font-bold uppercase tracking-widest border-b border-white/20 hover:border-white/50 transition-all pb-1"
            >
              Reset Names
            </button>
          )}
        </div>

        {/* Story Modal */}
        {result && !isSpinning && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] max-w-lg w-full overflow-hidden shadow-2xl border-8 border-orange-50 transform transition-all animate-in zoom-in duration-300">

              {isLoadingMemory ? (
                <div className="p-16 flex flex-col items-center justify-center">
                  <div className="loader mb-6"></div>
                  <p className="text-orange-500 font-bold text-xl animate-pulse">Yeayyyyy</p>
                </div>
              ) : (
                <div>
                  <div className="relative p-6">
                    <div
                      className={`bg-orange-50 rounded-[30px] border-4 border-orange-100 flex items-center justify-center w-full h-72 overflow-hidden relative group/img cursor-zoom-in ${photoMap[result] ? "" : "p-4"}`}
                      onClick={() => setIsImageEnlarged(true)}
                    >
                      <img
                        src={photoMap[result] || "/logo.png"}
                        alt={result}
                        className={photoMap[result] ? "w-full h-full object-cover" : "max-h-full object-contain"}
                      />

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsImageEnlarged(true);
                        }}
                        className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white bg-[#ff8c42] hover:bg-[#e66b1a] transition-all shadow-xl z-10 border-2 border-white/20"
                        title="Perbesar gambar"
                      >
                        <Maximize2 className="w-5 h-5" strokeWidth={3} />
                      </button>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff8c42] text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg whitespace-nowrap flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5 fill-current" /> <span>{result}</span> <Sparkles className="w-5 h-5 fill-current" />
                    </div>
                  </div>
                  <div className="p-8 text-center pt-10">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">WIB</h2>
                    <p className="text-gray-500 font-medium mb-8">Waktu Indonesia Bercerita</p>
                    <button
                      onClick={handleNext}
                      className="w-full bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold py-4 rounded-2xl transition-all border-b-4 border-orange-200 active:translate-y-1 active:border-b-0"
                    >
                      ONE MORE
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Enlarged Image Overlay */}
        {isImageEnlarged && result && photoMap[result] && (
          <div
            className="enlarge-overlay fixed inset-0 flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
            onClick={() => setIsImageEnlarged(false)}
          >
            <button
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
              onClick={() => setIsImageEnlarged(false)}
            >
              <X className="w-10 h-10" />
            </button>
            <div
              className="relative max-w-5xl w-full max-h-[85vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={photoMap[result]}
                alt={result}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border-4 border-white/10"
              />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white font-bold text-2xl tracking-widest drop-shadow-lg">
                {result.toUpperCase()}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
