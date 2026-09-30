import React from 'react';
import { motion } from 'framer-motion';

export interface CloudBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  showIsometricRacks?: boolean;
  id?: string;
}

export const CloudBackground: React.FC<CloudBackgroundProps> = ({
  children,
  className = '',
  showIsometricRacks = true,
  id,
}) => {
  return (
    <div id={id} className={`relative overflow-hidden bg-[#050816] ${className}`}>
      {/* 1. Deep Layered Ambient Gradient Blobs (Dribbble Cloud Data Service aesthetic) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-[15%] left-[10%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-transparent blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            x: [0, -40, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[35%] -right-[10%] w-[750px] h-[750px] rounded-full bg-gradient-to-bl from-indigo-600/15 via-purple-600/10 to-transparent blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            y: [0, -30, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-[10%] left-[25%] w-[800px] h-[800px] rounded-full bg-gradient-to-t from-emerald-500/10 via-cyan-600/10 to-transparent blur-[130px]"
        />

        {/* 2. Perspective Isometric Cloud Grid */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #06b6d4 1px, transparent 1px),
              linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            transform: 'perspective(1000px) rotateX(25deg) translateY(-80px)',
            transformOrigin: 'top center',
          }}
        />

        {/* 3. Glowing Isometric Data Service Flow Vectors & Floating Nodes */}
        {showIsometricRacks && (
          <div className="absolute inset-0 opacity-40">
            {/* Top Right Floating Cloud Node */}
            <motion.div
              animate={{ y: [0, -14, 0], rotate: [0, 1, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-20 right-12 hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/60 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <div className="text-xs font-mono text-cyan-300">
                <span className="text-slate-400">LEDGER HEAD:</span> #24808983
              </div>
            </motion.div>

            {/* Mid Left Floating Data Node */}
            <motion.div
              animate={{ y: [0, 16, 0], rotate: [0, -1, 0] }}
              transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute top-96 left-8 hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/60 backdrop-blur-md border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <div className="text-xs font-mono text-indigo-300">
                <span className="text-slate-400">STORAGE:</span> SIMULATED CLOUD
              </div>
            </motion.div>

            {/* Bottom Right Floating Node */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute bottom-24 right-20 hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/60 backdrop-blur-md border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="text-xs font-mono text-emerald-300">
                <span className="text-slate-400">STATUS:</span> INTEGRITY VERIFIED
              </div>
            </motion.div>
          </div>
        )}

        {/* 4. Subtle Radial Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050816]/40 to-[#050816] pointer-events-none" />
      </div>

      {/* Children Page Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
