import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, FastForward } from 'lucide-react';

interface IntroSequenceProps {
  onComplete: () => void;
}

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<number>(0);
  const [skipped, setSkipped] = useState<boolean>(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete();
      return;
    }

    // Sequence stages:
    // 0: Initial cloud outline & particle field
    // 1: Center File Icon & SHA-256 Hash Ring
    // 2: Cryptographic Version Linkage (V1 -> V2 -> V3)
    // 3: Shield Lock & Verification Glow
    // 4: Title Reveal & Fade Out to Hero
    const t1 = setTimeout(() => setStage(1), 900);
    const t2 = setTimeout(() => setStage(2), 2000);
    const t3 = setTimeout(() => setStage(3), 3200);
    const t4 = setTimeout(() => setStage(4), 4400);
    const t5 = setTimeout(() => {
      onComplete();
    }, 5600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  const handleSkip = () => {
    setSkipped(true);
    sessionStorage.setItem('bt032_intro_seen', 'true');
    onComplete();
  };

  if (skipped) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#030611] text-white overflow-hidden select-none"
      >
        {/* Skip button always available */}
        <button
          onClick={handleSkip}
          className="absolute top-6 right-6 z-20 flex items-center gap-1.5 rounded-full bg-slate-900/80 border border-slate-700/80 px-4 py-2 text-xs font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-400/50 backdrop-blur-md transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        >
          <span>Skip Intro</span>
          <FastForward className="h-3.5 w-3.5" />
        </button>

        {/* Ambient background glow rings */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute w-[350px] h-[350px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

        {/* Dynamic Logo Geometry Canvas */}
        <div className="relative flex items-center justify-center w-80 h-80">
          {/* Stage 1: Cloud & Concentric Hash Rings */}
          <motion.svg
            viewBox="0 0 200 200"
            className="w-full h-full overflow-visible"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {/* Outer Orbiting Hash Ring */}
            <motion.circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.5"
              strokeDasharray="6 8"
              opacity="0.35"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
            />

            {/* Inner Counter-Rotating Hex Ring */}
            <motion.circle
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              opacity="0.4"
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
            />

            {/* Stage 0-1: Cloud Shape */}
            <motion.path
              d="M65 110 C50 110 40 98 40 85 C40 73 49 63 60 62 C64 45 79 32 98 32 C118 32 135 47 138 67 C148 68 158 77 158 88 C158 100 148 110 135 110 Z"
              fill="none"
              stroke="url(#cloudGlow)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
            />

            {/* Stage 2: Linked Version Nodes V1 -> V2 -> V3 */}
            {stage >= 2 && (
              <g>
                {/* Connecting Links */}
                <motion.line
                  x1="70"
                  y1="135"
                  x2="100"
                  y2="135"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5 }}
                />
                <motion.line
                  x1="100"
                  y1="135"
                  x2="130"
                  y2="135"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                />

                {/* Node V1 */}
                <motion.circle
                  cx="70"
                  cy="135"
                  r="7"
                  fill="#050816"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
                <text x="70" y="152" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  V1
                </text>

                {/* Node V2 */}
                <motion.circle
                  cx="100"
                  cy="135"
                  r="7"
                  fill="#050816"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                />
                <text x="100" y="152" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  V2
                </text>

                {/* Node V3 */}
                <motion.circle
                  cx="130"
                  cy="135"
                  r="7"
                  fill="#050816"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.6 }}
                />
                <text x="130" y="152" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  V3
                </text>
              </g>
            )}

            {/* Stage 3: Center Cryptographic Shield Lock */}
            {stage >= 3 && (
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              >
                <path
                  d="M100 55 L125 66 V90 C125 106 114 120 100 126 C86 120 75 106 75 90 V66 Z"
                  fill="#07111F"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  filter="url(#shieldShadow)"
                />
                <motion.path
                  d="M92 90 L98 96 L108 84"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                />
              </motion.g>
            )}

            <defs>
              <linearGradient id="cloudGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <filter id="shieldShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#22d3ee" floodOpacity="0.5" />
              </filter>
            </defs>
          </motion.svg>

          {/* Floating Cryptographic Hashes */}
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.8, y: 0 }}
              className="absolute -bottom-8 font-mono text-[10px] text-cyan-400 tracking-wider"
            >
              SHA-256: d5a4e819b7...7f2c
            </motion.div>
          )}
        </div>

        {/* Stage 4: Typography & Project Branding Reveal */}
        <div className="mt-10 text-center max-w-lg px-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: stage >= 3 ? 1 : 0, y: stage >= 3 ? 0 : 15 }}
            transition={{ duration: 0.6 }}
            className="text-[11px] font-mono tracking-[0.25em] uppercase text-cyan-400 mb-2"
          >
            CLOUD INTEGRITY & VERIFICATION ENGINE
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: stage >= 3 ? 1 : 0, y: stage >= 3 ? 0 : 15 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2"
          >
            Auditing Mechanism in Cloud Data Services
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 3 ? 0.8 : 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xs font-mono text-slate-400"
          >
            Version-Based Dynamic Cloud Data Auditing
          </motion.p>
        </div>

        {/* Progress Timeline Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5.6, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
