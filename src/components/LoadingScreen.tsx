import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  isLoading: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    
    const duration = 4800; // 4.8 seconds loading duration
    const intervalTime = 48; // update every 48ms
    const step = 100 / (duration / intervalTime);

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        return next >= 100 ? 100 : next;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Format progress as 3-digit percentage e.g., 088%
  const formattedPercent = String(Math.floor(progress)).padStart(3, '0') + '%';

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
          className="fixed inset-0 bg-[#04050e] z-50 flex flex-col items-center justify-center overflow-hidden"
        >
          {/* 1. Background Grid Axis Lines (matching screenshot) */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Vertical crosshair line on the left */}
            <div className="absolute left-[10%] top-0 bottom-0 w-[1px] bg-indigo-500/10 shadow-[0_0_8px_rgba(99,102,241,0.05)]" />
            {/* Horizontal crosshair line through the lower center */}
            <div className="absolute top-[56%] left-0 right-0 h-[1px] bg-indigo-500/10 shadow-[0_0_8px_rgba(99,102,241,0.05)]" />
          </div>

          {/* 2. Soft Background Violet/Blue Glow */}
          <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600/5 filter blur-[120px] pointer-events-none -translate-y-10" />

          {/* 3. Loader Content Card */}
          <div className="flex flex-col items-center z-10 space-y-7">
            
            {/* Mascot Image Container with Glowing Halo */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Outer Blue Halo ring (matching image) */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-transparent border-t-indigo-500/80 border-r-violet-600/80 border-b-indigo-900/20"
                style={{ filter: "drop-shadow(0 0 12px rgba(99, 102, 241, 0.45))" }}
              />
              {/* Inner subtle glow ring */}
              <div className="absolute -inset-1 rounded-full border border-indigo-400/20" />

              {/* Mascot Avatar Frame */}
              <div className="w-28 h-28 rounded-full overflow-hidden border border-indigo-500/35 bg-[#090A0F] flex items-center justify-center p-1.5 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                <img
                  src="/kikatracker_mascot.jpg"
                  alt="Mascot Logo"
                  className="w-full h-full rounded-full object-cover brightness-105 contrast-105"
                />
              </div>
            </div>

            {/* App Branding Title */}
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-black tracking-[0.06em] text-white leading-none font-sans drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] uppercase">
                XPERT
              </h1>
              <p className="text-[10px] tracking-[0.28em] text-indigo-400/80 font-mono uppercase font-bold">
                LOADING KIRKA DATA
              </p>
            </div>

            {/* Progress Bar & Indicators Container */}
            <div className="w-72 space-y-2.5 pt-2">
              {/* Progress Bar Track */}
              <div className="w-full h-1.5 bg-indigo-950/80 rounded-full overflow-hidden border border-white/5 relative">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-75"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Bottom Labels (SYS.BOOT and dynamic % indicator) */}
              <div className="flex justify-between items-center text-[10px] font-mono text-indigo-400/60 uppercase tracking-widest px-0.5">
                <span>SYS.BOOT</span>
                <span className="text-indigo-300 font-bold">{formattedPercent}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
