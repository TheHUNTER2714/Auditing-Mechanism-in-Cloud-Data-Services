import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Shield, 
  Database, 
  Layers, 
  Sparkles, 
  Play, 
  Server,
  Lock,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { PublicNavbar } from '../components/PublicNavbar';
import { IntroSequence } from '../components/IntroSequence';
import { DataCenterScene } from '../components/DataCenterScene';
import { CloudBackground } from '../components/CloudBackground';

export const LandingPage: React.FC = () => {
  const [showIntro, setShowIntro] = useState(false);

  return (
    <div className="min-h-screen bg-[#02040A] text-[#F1F5F9] flex flex-col overflow-x-hidden">
      <PublicNavbar />

      {/* Intro Sequence Overlay (Replayable) */}
      <AnimatePresence>
        {showIntro && (
          <IntroSequence onComplete={() => setShowIntro(false)} />
        )}
      </AnimatePresence>

      {/* Floating Replay Intro Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowIntro(true)}
          className="flex items-center gap-2 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 px-4 py-2 text-xs font-mono text-slate-300 hover:text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] backdrop-blur-md transition-all cursor-pointer"
        >
          <Play className="h-3 w-3 text-cyan-400" />
          <span>Replay Logo Intro</span>
        </button>
      </div>

      {/* ========================================================
          1. CINEMATIC HERO SECTION
          ======================================================== */}
      <section className="relative min-h-[92vh] flex flex-col justify-between overflow-hidden pt-16">
        {/* Fullscreen Cloud Data Center Server Corridor Background */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <motion.img
            src="/cloud-datacenter-bg.jpg"
            alt="Cloud Data Center Infrastructure"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-70"
          />

          {/* Interactive Floating Particle & Cryptographic Stream Canvas */}
          <DataCenterScene className="absolute inset-0 w-full h-full opacity-65" />

          {/* Deep Cyan & Obsidian Tech Lighting Overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#02040A]/85 via-transparent to-[#02040A] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#02040A]/70 via-transparent to-[#02040A]/70 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,#02040A_95%)] pointer-events-none" />
        </div>

        {/* Hero Top Session Pill & Academic Meta */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-950/60 border border-cyan-400/40 px-3.5 py-1 text-[11px] text-cyan-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="tracking-[0.2em] font-semibold">ACTIVE CLOUD DATA SERVICES RESEARCH PROTOTYPE</span>
          </div>

          <div className="flex items-center gap-3 text-slate-300 text-[11px] tracking-wider uppercase">
            <span>STORAGE (simulated)</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-semibold">ENGINE ONLINE</span>
          </div>
        </div>

        {/* Hero Centerpiece: Editorial Typography & Title */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col items-center text-center my-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl tracking-[0.2em] text-white font-light drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)] select-none">
              CLOUD AUDIT
            </h1>
            <div className="w-24 sm:w-32 h-1 bg-cyan-400 rounded-full mx-auto my-4 sm:my-5 shadow-[0_0_16px_#22d3ee]" />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-3 max-w-3xl mx-auto"
          >
            <div className="text-base sm:text-2xl font-serif text-slate-200 tracking-wide font-normal">
              Auditing Mechanism in Cloud Data Services
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-700/80 px-3.5 py-1 text-xs font-mono text-cyan-300 backdrop-blur-md">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>Model: <strong>Version-Based Dynamic Cloud Data Auditing</strong></span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto font-light leading-relaxed drop-shadow-md pt-2">
              Continuous cryptographic verification for initial file ingestion and dynamic re-uploads in simulated cloud storage. Streaming 1 MB SHA-256 digests, unforgeable HMAC version chaining, and client-held verification receipts that defeat silent rollback attacks.
            </p>
          </motion.div>

          {/* Explicit Public CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="pt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/overview"
              className="rounded-full bg-white text-slate-950 px-8 py-3.5 text-xs uppercase tracking-widest font-semibold shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:bg-cyan-200 transition-all hover:scale-105 inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Explore Project</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-950" />
            </Link>
            <Link
              to="/login"
              className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 px-8 py-3.5 text-xs uppercase tracking-widest font-bold shadow-[0_0_25px_rgba(34,211,238,0.3)] hover:from-cyan-400 hover:to-blue-500 transition-all hover:scale-105 inline-flex items-center gap-2"
            >
              <Server className="h-3.5 w-3.5 text-slate-950" />
              <span>Open Dashboard</span>
            </Link>
          </motion.div>
        </div>

        {/* Hero Bottom Strip */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-400">
          <div>RESEARCH MODEL: VERSION-BASED DYNAMIC CLOUD DATA AUDITING (V-DCA)</div>
          <div className="text-cyan-400 font-medium">DEPARTMENT OF CSE • 2026</div>
        </div>
      </section>

      {/* ========================================================
          2. SHORT EXPLANATION & ARCHITECTURAL SUMMARY
          ======================================================== */}
      <CloudBackground className="py-24 px-6 md:px-12 border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
              SYSTEM FOUNDATIONS
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-light text-white leading-tight">
              Why Dynamic Cloud Data Services Need Continuous Auditing
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
              When client data resides in third-party cloud data services, silent data corruption, unannounced byte overwrites, and rollback attacks remain invisible to traditional static checks. The V-DCA model binds dynamic update operations to an immutable cryptographic chain anchored by owner verification receipts.
            </p>
          </div>

          {/* 4 Key Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4 hover:border-cyan-400/40 transition-all">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 w-fit">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-white">Active Payload Verification</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Streams SHA-256 over 1 MB storage blocks to verify physical disk state without requiring third-party cloud provider trust.
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-cyan-300">
                D_v = SHA256(BlockStream)
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4 hover:border-blue-400/40 transition-all">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 w-fit">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-white">HMAC Version Chaining</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Binds dynamic re-uploads to prior version signatures using an unexposed server secret, preventing offline forgery or revision insertion.
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-blue-300">
                HC_v = HMAC(K_chain, ...)
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4 hover:border-indigo-400/40 transition-all">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 w-fit">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-white">Anti-Rollback Receipts</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Client-pinned cryptographic receipts ensure malicious cloud providers cannot restore outdated snapshots to conceal data loss.
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-indigo-300">
                Client-Pinned Receipts
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4 hover:border-emerald-400/40 transition-all">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-white">Precedence Forensics</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Evaluates version history integrity first, then inspects disk blocks, identifying exact corruption cause with sub-second stopwatch precision.
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-emerald-300">
                Chain Integrity → Disk Check
              </div>
            </div>
          </div>

          {/* Quick Call to Action Strip */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-indigo-950/40 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <div>
              <h4 className="font-serif text-xl text-white font-medium mb-1">
                Read the Complete Research Paper Specifications
              </h4>
              <p className="text-xs text-slate-400 font-light">
                Explore the problem statement, cryptographic formulations, system architecture, and honest limitations.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/overview"
                className="px-6 py-2.5 rounded-full bg-cyan-400 text-slate-950 text-xs font-semibold uppercase tracking-wider hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(34,211,238,0.25)]"
              >
                Project Overview
              </Link>
              <Link
                to="/login"
                className="px-6 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-white text-xs font-semibold uppercase tracking-wider hover:bg-slate-800 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </CloudBackground>

      {/* ========================================================
          3. MINIMAL PUBLIC FOOTER
          ======================================================== */}
      <footer className="py-12 px-6 bg-[#010206] border-t border-slate-800/80 text-center text-xs font-mono text-slate-500 space-y-3">
        <div className="text-slate-400 uppercase tracking-widest text-[11px]">
          Auditing Mechanism in Cloud Data Services
        </div>
        <div>
          Model: Version-Based Dynamic Cloud Data Auditing (V-DCA) • Major B.Tech Project 2026
        </div>
        <div className="text-slate-600 text-[10px]">
          Supervised by Dr. Ashish Kumar Mishra • Bharat Ratna Babasaheb Bhimrao Ambedkar Rajkiya Engineering College, Pratapgarh
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
