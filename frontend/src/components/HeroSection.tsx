import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Layers, 
  UploadCloud, 
  Search, 
  ArrowDown, 
  CheckCircle2, 
  HardDrive,
  Activity,
  Compass
} from 'lucide-react';
import { DataCenterScene } from './DataCenterScene';
import type { StatsResponse } from '../api/types';

interface HeroSectionProps {
  stats: StatsResponse | null;
  isOnline: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ stats, isOnline }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Parallax transformations matching reference specifications
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.92]);
  const heroRadius = useTransform(scrollYProgress, [0, 0.25], ['0px', '32px']);
  const textY = useTransform(scrollYProgress, [0, 0.2], [0, -60]);

  return (
    <section ref={containerRef} className="relative h-[115vh] flex items-start justify-center pt-8 px-2 sm:px-6">
      <motion.div
        style={{ scale: heroScale, borderRadius: heroRadius }}
        className="relative w-full h-[85vh] overflow-hidden shadow-2xl bg-[#050816] border border-cyan-500/20"
      >
        {/* Background SVG + Canvas Data Center Scene replacing desert photo */}
        <div className="absolute inset-0">
          <DataCenterScene className="w-full h-full" />
        </div>

        {/* Hero Content in 3 rows: Top Meta, Big Title Block, Bottom Stats Row */}
        <motion.div
          style={{ y: textY }}
          className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 md:p-12 text-[#F1F5F9] z-40"
        >
          {/* Row 1: Top Meta */}
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[11px] uppercase tracking-[0.25em] font-mono font-medium text-cyan-400">
                PROJECT PROGRESS
              </span>
            </div>
            <div className="text-[11px] uppercase font-mono tracking-widest text-slate-400">
              CLOUD INFRASTRUCTURE • AUDIT ENGINE
            </div>
          </div>

          {/* Row 2: Big Title Block */}
          <div className="max-w-4xl space-y-3 sm:space-y-4 my-auto">
            {/* Model Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-950/60 border border-cyan-400/30 px-3 py-1 text-xs font-mono text-cyan-300">
              <span>Model:</span>
              <strong className="text-white font-medium">Version-Based Dynamic Cloud Data Auditing</strong>
            </div>

            {/* Main Title (Non-negotiable exact name) */}
            <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-light leading-[1.08] tracking-tight text-white">
              Auditing Mechanism in <br />
              <span className="italic font-serif font-normal bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                Cloud Data Services
              </span>
            </h1>

            {/* Tagline & Subtitle */}
            <p className="text-sm sm:text-base font-mono font-medium text-cyan-400/90">
              "Where Every Data Change Leaves a Trace"
            </p>
            <p className="max-w-xl text-xs sm:text-sm text-slate-300/90 leading-relaxed font-light">
              A practical approach to cloud data integrity, version tracking, and audit-history verification in simulated cloud storage.
            </p>

            {/* Status Chips Row */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] border ${
                isOnline ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-amber-950/40 text-amber-400 border-amber-500/30'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                AUDIT ENGINE {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/60 px-2.5 py-1 font-mono text-[10px] text-slate-300 border border-slate-700/50">
                <HardDrive className="h-3 w-3 text-cyan-400" />
                STORAGE: SIMULATED CLOUD
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-950/40 px-2.5 py-1 font-mono text-[10px] text-blue-300 border border-blue-500/30">
                <Shield className="h-3 w-3 text-blue-400" />
                INTEGRITY: SHA-256 + HMAC
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] text-cyan-300 border border-cyan-500/30">
                <Layers className="h-3 w-3 text-cyan-400" />
                VERSION CHAIN: ACTIVE
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Link
                to="/upload"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-[1.02]"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Upload & Anchor New File</span>
              </Link>
              <Link
                to="/files"
                className="flex items-center gap-2 rounded-xl glass-panel px-5 py-2.5 text-xs font-semibold text-white hover:border-cyan-400/50 transition-all hover:scale-[1.02]"
              >
                <Search className="h-4 w-4 text-cyan-400" />
                <span>Verify Live Stored Files</span>
              </Link>
            </div>
          </div>

          {/* Row 3: Bottom Stats Row with top border */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-t border-white/20 pt-4 gap-4">
            <div className="flex items-center space-x-2 text-xs uppercase tracking-widest text-slate-400">
              <Compass className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '12s' }} />
              <span className="font-mono text-[11px]">SCROLL TO TRACE THE AUDIT</span>
            </div>

            {/* Real Numbers from Backend / SQLite */}
            <div className="flex items-center space-x-6 sm:space-x-8 text-xs uppercase tracking-wider font-mono">
              <div>
                <span className="block text-cyan-400 text-lg sm:text-xl font-serif font-bold">
                  {stats?.total_versions ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">VERSION CHAIN BLOCKS</span>
              </div>
              <div>
                <span className="block text-emerald-400 text-lg sm:text-xl font-serif font-bold">
                  {stats?.audits_performed ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">AUDITS LOGGED</span>
              </div>
              <div className="hidden md:block">
                <span className="block text-white text-lg sm:text-xl font-serif font-bold">
                  {stats?.total_files ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">STORED FILES</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};
