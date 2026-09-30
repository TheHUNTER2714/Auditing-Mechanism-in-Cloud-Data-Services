import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight,
  Shield, 
  Layers, 
  Sparkles, 
  Database, 
  Activity, 
  Server, 
  Key, 
  Play, 
  Compass, 
  UploadCloud, 
  RefreshCw, 
  FileCheck, 
  FileText
} from 'lucide-react';
import { IntroSequence } from '../components/IntroSequence';
import { DataCenterScene } from '../components/DataCenterScene';
import { CloudBackground } from '../components/CloudBackground';
import { fetchStats, fetchHealth, fetchConfig } from '../api/client';
import type { StatsResponse, ConfigResponse } from '../api/types';

interface SessionData {
  id: string;
  sessionNum: string;
  tagline: string;
  headlineLine1: string;
  headlineLine2: string;
  description: string;
  primaryBtnText: string;
  primaryBtnLink: string;
  secondaryBtnText: string;
  secondaryBtnLink: string;
  topic: string;
}

const SESSIONS: SessionData[] = [
  {
    id: 'ingestion',
    sessionNum: 'SESSION 01',
    tagline: 'Baseline payload ingestion in simulated cloud storage.',
    headlineLine1: 'When data enters the cloud.',
    headlineLine2: 'Certainty begins with a hash.',
    description: 'When physical drive control is ceded to third-party cloud data services, silent degradation, bit rot, and unannounced modifications remain invisible. Initial file ingestion streams 1 MB chunks to compute an immutable SHA-256 baseline digest (D_1), creating the foundational block for all future dynamic re-uploads.',
    primaryBtnText: 'INGEST INITIAL FILE',
    primaryBtnLink: '/upload',
    secondaryBtnText: 'VIEW STORED FILES',
    secondaryBtnLink: '/files',
    topic: 'INITIAL INGESTION'
  },
  {
    id: 'reupload',
    sessionNum: 'SESSION 02',
    tagline: 'Cryptographic state transition upon file re-upload.',
    headlineLine1: 'Every re-upload links forward.',
    headlineLine2: 'None can rewrite history.',
    description: 'Cloud data is dynamic: files are continually modified and re-uploaded. When a user re-uploads a new version, our prototype archives the previous version and binds the new SHA-256 payload digest to the previous block signature using an unexposed server secret (CHAIN_SECRET). Any out-of-band manipulation to historic versions snaps the HMAC chain immediately.',
    primaryBtnText: 'RE-UPLOAD / UPDATE FILE',
    primaryBtnLink: '/upload',
    secondaryBtnText: 'INSPECT HASH CHAIN',
    secondaryBtnLink: '/files',
    topic: 'DYNAMIC RE-UPLOAD'
  },
  {
    id: 'receipts',
    sessionNum: 'SESSION 03',
    tagline: 'Client-held verification receipts defeating rollback amnesia.',
    headlineLine1: 'Receipts pinned in your browser.',
    headlineLine2: 'The cloud cannot deny your re-uploads.',
    description: 'Upon every successful file ingestion or re-upload, an unforgeable cryptographic receipt containing the version number, timestamp, and signature is returned and pinned in local browser storage. If a cloud service attempts to restore an obsolete snapshot to conceal data loss or a ransomware event, the client receipt detects the revision rollback instantly.',
    primaryBtnText: 'INSPECT RECEIPT ANCHOR',
    primaryBtnLink: '/dashboard',
    secondaryBtnText: 'AUDIT LEDGER',
    secondaryBtnLink: '/audits',
    topic: 'ANTI-ROLLBACK RECEIPTS'
  },
  {
    id: 'forensics',
    sessionNum: 'SESSION 04',
    tagline: 'Strict precedence evaluation: Chain integrity -> Disk payload.',
    headlineLine1: 'Chain first. Content second.',
    headlineLine2: 'Definitive tamper diagnosis.',
    description: 'Our verification engine follows strict mathematical precedence: verify version chain continuity first, then stream SHA-256 over physical disk blocks. It differentiates between physical disk corruption (TAMPERED) and database modification (VERSION_HISTORY_ALTERED) with sub-second stopwatch precision.',
    primaryBtnText: 'RUN LIVE AUDIT NOW',
    primaryBtnLink: '/audits',
    secondaryBtnText: 'SYSTEM DASHBOARD',
    secondaryBtnLink: '/dashboard',
    topic: 'PRECEDENCE FORENSICS'
  }
];

export function HomePage() {
  const sessionsRef = useRef<HTMLDivElement>(null);
  
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showIntro, setShowIntro] = useState<boolean>(false);
  const [chainSimValid, setChainSimValid] = useState<boolean>(true);
  const [activeSessionIndex, setActiveSessionIndex] = useState<number>(0);

  useEffect(() => {
    const seen = sessionStorage.getItem('bt032_intro_seen');
    if (!seen) {
      setShowIntro(true);
    }

    const loadData = async () => {
      try {
        await fetchHealth();
        setIsOnline(true);
        const [s, c] = await Promise.all([fetchStats(), fetchConfig()]);
        setStats(s);
        setConfig(c);
      } catch {
        setIsOnline(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
    sessionStorage.setItem('bt032_intro_seen', 'true');
  };

  const scrollToSessions = () => {
    sessionsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeSession = SESSIONS[activeSessionIndex];

  return (
    <div className="relative bg-[#02040A] text-[#F1F5F9] font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-300 min-h-screen">
      {/* 1. Animated Logo Intro Sequence (Session Cached) */}
      {showIntro && <IntroSequence onComplete={handleIntroComplete} />}

      {/* Floating Replay Intro Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setShowIntro(true)}
          className="flex items-center gap-1.5 rounded-full bg-slate-950/80 border border-slate-700/80 px-3 py-1.5 text-[11px] font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-400/50 backdrop-blur-md shadow-2xl transition-all cursor-pointer"
          title="Replay the cryptographic logo sequence"
        >
          <Play className="h-3 w-3 text-cyan-400" />
          <span>Replay Logo Intro</span>
        </button>
      </div>

      {/* ========================================================
          HERO STAGE: CLOUD DATA CENTER BACKGROUND + APOGEE-HQ EDITORIAL
          ======================================================== */}
      <section className="relative min-h-screen flex flex-col justify-between overflow-hidden">
        {/* Fullscreen Cloud Data Center Server Corridor Background */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          {/* Photorealistic Cloud Data Center Image with Smooth Ken-Burns Pulse */}
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
            <span className="tracking-[0.2em] font-semibold">SESSION 01 • ACTIVE CLOUD PROTOTYPE</span>
          </div>

          <div className="flex items-center gap-3 text-slate-300 text-[11px] tracking-wider uppercase">
            <span>STORAGE (simulated)</span>
            <span className="text-slate-600">•</span>
            <span className={isOnline ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              ENGINE {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Hero Centerpiece: SpaceEdu Editorial Typography with Project Focus */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col items-center text-center my-auto">
          {/* Grand Title with Atmospheric Glow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl tracking-[0.2em] text-white font-light drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)] select-none">
              CLOUD AUDIT
            </h1>
            {/* Signature Cyan Line Accent */}
            <div className="w-24 sm:w-32 h-1 bg-cyan-400 rounded-full mx-auto my-4 sm:my-5 shadow-[0_0_16px_#22d3ee]" />
          </motion.div>

          {/* Exact Non-negotiable Project Title & Model Subhead */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-3 max-w-3xl mx-auto"
          >
            <div className="text-base sm:text-xl font-serif text-slate-200 tracking-wide font-normal">
              Auditing Mechanism in Cloud Data Services
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-700/80 px-3.5 py-1 text-xs font-mono text-cyan-300 backdrop-blur-md">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>Model: <strong>Version-Based Dynamic Cloud Data Auditing</strong></span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto font-light leading-relaxed drop-shadow-md pt-1">
              Continuous cryptographic verification for initial file ingestion and dynamic re-uploads in simulated cloud storage. Streaming 1 MB SHA-256 digests, unforgeable HMAC version chaining, and client-held verification receipts that defeat silent rollback attacks.
            </p>
          </motion.div>

          {/* Dual Action Pill Buttons */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="pt-6 flex flex-wrap items-center justify-center gap-3"
          >
            <button
              onClick={scrollToSessions}
              className="rounded-full bg-white text-slate-950 px-8 py-3.5 text-xs uppercase tracking-widest font-semibold shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:bg-cyan-200 transition-all hover:scale-105 inline-flex items-center gap-2 group cursor-pointer"
            >
              <span>EXPLORE SESSIONS</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-950 group-hover:translate-x-1 transition-transform" />
            </button>
            <Link
              to="/upload"
              className="rounded-full bg-slate-900/80 text-white border border-slate-700 backdrop-blur-md px-8 py-3.5 text-xs uppercase tracking-widest font-semibold hover:border-cyan-400 hover:text-cyan-300 transition-all hover:scale-105 inline-flex items-center gap-2"
            >
              <UploadCloud className="h-3.5 w-3.5 text-cyan-400" />
              <span>INGEST OR RE-UPLOAD</span>
            </Link>
          </motion.div>
        </div>

        {/* Hero Bottom: Status Strip over Server Corridor */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-6 pt-4 border-t border-white/15 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono">
          <div className="flex items-center space-x-2 text-slate-300 uppercase tracking-widest text-[11px]">
            <Compass className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '16s' }} />
            <span>SCROLL TO TRACE DYNAMIC AUDIT PHASES</span>
          </div>

          <div className="flex items-center space-x-6 sm:space-x-10 text-[11px] uppercase tracking-wider">
            <div>
              <span className="text-cyan-300 font-serif font-bold text-lg mr-1.5">
                {stats?.total_versions ?? 0}
              </span>
              <span className="text-slate-400">VERSION BLOCKS</span>
            </div>
            <div>
              <span className="text-emerald-400 font-serif font-bold text-lg mr-1.5">
                {stats?.audits_performed ?? 0}
              </span>
              <span className="text-slate-400">AUDITS LOGGED</span>
            </div>
            <div className="hidden md:block">
              <span className="text-white font-serif font-bold text-lg mr-1.5">
                {stats?.total_files ?? 0}
              </span>
              <span className="text-slate-400">STORED FILES</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          EDITORIAL SESSIONS: DYNAMIC RE-UPLOAD & LIFECYCLE CHAPTERS
          ======================================================== */}
      <CloudBackground>
        <section 
          ref={sessionsRef} 
          id="sessions" 
          className="relative py-24 px-6 md:px-12 border-t border-slate-800/80 bg-transparent overflow-hidden"
        >
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Session Switcher Pills */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-6">
            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mr-2">
              AUDIT PHASES:
            </span>
            {SESSIONS.map((sess, idx) => (
              <button
                key={sess.id}
                onClick={() => setActiveSessionIndex(idx)}
                className={`px-4 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all cursor-pointer ${
                  activeSessionIndex === idx
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                {sess.sessionNum} • {sess.topic}
              </button>
            ))}
          </div>

          {/* Editorial Split Layout: Left Text & Action Pills + Right Interactive Visualizer */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSession.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
            >
              {/* Left Column: SpaceEdu Typography & Editorial Copy */}
              <div className="lg:col-span-7 space-y-6">
                {/* Pill Tag */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-cyan-950/70 border border-cyan-400/40 px-3.5 py-1 text-xs font-mono uppercase tracking-wider text-cyan-300 backdrop-blur-sm">
                    {activeSession.sessionNum}
                  </span>
                  <span className="text-xs text-slate-400 font-mono tracking-wide">
                    {activeSession.tagline}
                  </span>
                </div>

                {/* Big Editorial Headline */}
                <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl font-light text-white leading-[1.1] tracking-tight">
                  {activeSession.headlineLine1} <br />
                  <span className="italic font-serif font-normal bg-gradient-to-r from-cyan-200 via-blue-300 to-indigo-200 bg-clip-text text-transparent">
                    {activeSession.headlineLine2}
                  </span>
                </h2>

                {/* Narrative Description */}
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light max-w-2xl drop-shadow">
                  {activeSession.description}
                </p>

                {/* Action Buttons (Apogee-HQ Pill Style) */}
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <Link
                    to={activeSession.primaryBtnLink}
                    className="flex items-center gap-2 rounded-full bg-white text-slate-950 px-7 py-3 text-xs uppercase tracking-widest font-semibold hover:bg-cyan-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:scale-[1.02]"
                  >
                    <span>{activeSession.primaryBtnText}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to={activeSession.secondaryBtnLink}
                    className="flex items-center gap-2 rounded-full bg-slate-900/80 text-white border border-slate-700 px-7 py-3 text-xs uppercase tracking-widest font-semibold hover:border-cyan-400 hover:text-cyan-300 backdrop-blur-md transition-all hover:scale-[1.02]"
                  >
                    <span>{activeSession.secondaryBtnText}</span>
                  </Link>
                </div>
              </div>

              {/* Right Column: Dynamic Interactive Diagnostic Card */}
              <div className="lg:col-span-5">
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border-slate-800 shadow-2xl space-y-6">
                  {activeSessionIndex === 0 && (
                    /* Initial Ingestion Simulator */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <span className="font-mono text-xs uppercase text-cyan-400">Baseline Ingestion</span>
                        <span className="text-[10px] font-mono text-slate-500">1MB Streaming Chunks</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#030611] border border-slate-800 space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Payload Name:</span>
                          <span className="text-slate-200">financial_q1.xlsx</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Initial Digest D_1:</span>
                          <span className="text-cyan-400 text-[11px] truncate max-w-[160px]">4a5f6b8c9d0e1f...</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Storage Target:</span>
                          <span className="text-slate-300">storage/current/1_file.xlsx</span>
                        </div>
                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                          <span className="text-slate-400">Baseline Status:</span>
                          <span className="text-emerald-400 font-bold">VERSION 1 SEALED</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                        Initial ingestion partitions the file into 1 MB chunks, computes the root digest, and issues an unforgeable baseline signature.
                      </p>
                    </div>
                  )}

                  {activeSessionIndex === 1 && (
                    /* Dynamic Re-upload Chain Visualizer */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <span className="font-mono text-xs uppercase text-cyan-400">Dynamic Re-upload Chain</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setChainSimValid(true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                              chainSimValid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-500'
                            }`}
                          >
                            Valid Chain
                          </button>
                          <button
                            onClick={() => setChainSimValid(false)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                              !chainSimValid ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-slate-500'
                            }`}
                          >
                            Tamper Version DB
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-2 py-4 bg-[#030611] rounded-2xl border border-slate-800">
                        <div className="px-3 py-1.5 rounded-lg bg-[#07111F] text-cyan-400 font-mono text-xs font-bold border border-cyan-500/30">
                          V1 (Original)
                        </div>
                        <div className={`h-0.5 w-10 ${chainSimValid ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                        <div className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold ${
                          chainSimValid 
                            ? 'bg-[#07111F] text-blue-400 border border-blue-500/30' 
                            : 'bg-red-950/80 text-red-400 border border-red-500 animate-pulse'
                        }`}>
                          V2 (Re-upload)
                        </div>
                        <div className={`h-0.5 w-10 ${chainSimValid ? 'bg-blue-400' : 'border-t border-dashed border-red-500'}`} />
                        <div className="px-3 py-1.5 rounded-lg bg-[#07111F] text-slate-300 font-mono text-xs font-bold border border-slate-700">
                          V3 (Re-upload)
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                        {chainSimValid 
                          ? 'Each re-upload computes HC_v = HMAC(K, D_v || HC_{v-1}). Any unauthorized database alteration to past versions breaks the chain instantly.' 
                          : 'Tamper detected! Altering historical database records breaks the HMAC sequence. Recalculation without server secret fails.'}
                      </p>
                    </div>
                  )}

                  {activeSessionIndex === 2 && (
                    /* Owner-Held Receipts */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <span className="font-mono text-xs uppercase text-cyan-400">Owner Receipt Anchor</span>
                        <Key className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="p-4 rounded-2xl bg-[#030611] border border-slate-800 space-y-2 font-mono text-[11px]">
                        <div className="text-slate-400">localStorage['bt032_receipt_#1']:</div>
                        <pre className="p-2.5 rounded bg-black/60 text-cyan-300 overflow-x-auto text-[10px] leading-tight">
{JSON.stringify({
  file_id: 1,
  version: 2,
  operation: "RE_UPLOAD",
  hash_chain: "7a9f2...8b1c",
  owner_receipt: "rcpt_9824...f01"
}, null, 2)}
                        </pre>
                      </div>
                      <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                        Cached in browser storage after each re-upload. If the cloud attempts to silently roll back to version 1, client comparison flags the rollback.
                      </p>
                    </div>
                  )}

                  {activeSessionIndex === 3 && (
                    /* Stopwatch Telemetry */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <span className="font-mono text-xs uppercase text-emerald-400">Stopwatch Audit Log</span>
                        <Activity className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="space-y-2 font-mono text-[10px]">
                        <div className="flex justify-between p-2 rounded-xl bg-[#030611] border border-slate-800">
                          <span className="text-slate-300">Phase 1: DB Version Retrieval</span>
                          <span className="text-cyan-400">1.8 ms</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-xl bg-[#030611] border border-slate-800">
                          <span className="text-slate-300">Phase 2: HMAC-SHA256 Chain</span>
                          <span className="text-cyan-400">3.4 ms</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-xl bg-[#030611] border border-slate-800">
                          <span className="text-slate-300">Phase 3: 1MB Streaming Digest</span>
                          <span className="text-cyan-400">8.9 ms</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-xl bg-[#030611] border border-slate-800">
                          <span className="text-slate-300">Audit Classification</span>
                          <span className="text-emerald-400 font-bold">PASS (14.1 ms)</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                        Every audit records millisecond timings in SQLite to verify system responsiveness under continuous surveillance.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ========================================================
          VERIFICATION PILLARS: 3-CARD SHOWCASE GRID
          ======================================================== */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row justify-between md:items-end">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
              CORE PILLARS
            </span>
            <h2 className="font-serif text-3xl md:text-5xl font-light text-white mt-2">
              Verification Architecture
            </h2>
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-400 mt-4 md:mt-0">
            Powered by SQLite and streaming SHA-256 in simulated cloud storage
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: 'Active Payload Verification',
              area: '1 MB Streaming Chunks',
              badge: 'D_v = SHA-256',
              desc: 'Audits physical file bytes on disk to catch silent corruption, drive degradation, or unauthorized out-of-band byte overwrites.',
              icon: Database,
              color: 'text-cyan-400',
            },
            {
              title: 'HMAC Version Chaining',
              area: 'Keyed Cryptographic Seal',
              badge: 'HC_v = HMAC-SHA256',
              desc: 'Links every authorized re-upload to its previous version signature using an unexposed server secret, preventing offline forgery attacks.',
              icon: Layers,
              color: 'text-blue-400',
            },
            {
              title: 'Forensic Audit & Tamper Trace',
              area: 'Precedence-Based Diagnosis',
              badge: 'PASS / TAMPER / ALTERED',
              desc: 'Distinguishes between disk corruption and version history tampering, with every audit trial recorded into SQLite with stopwatch timings.',
              icon: Shield,
              color: 'text-emerald-400',
            },
          ].map((pillar, idx) => (
            <div key={idx} className="group cursor-pointer space-y-4">
              <div className="relative overflow-hidden rounded-3xl aspect-[4/5] glass-panel p-6 sm:p-8 flex flex-col justify-between border-slate-800 transition-all duration-500 group-hover:scale-[1.03] group-hover:border-cyan-400/40 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/10 pointer-events-none" />
                
                <div className="relative z-10 flex justify-between items-start">
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-cyan-400 group-hover:border-cyan-400/40 transition-colors">
                    <pillar.icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-900/90 border border-slate-800 px-3 py-1 font-mono text-[10px] text-cyan-300">
                    {pillar.badge}
                  </span>
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="font-mono text-[10px] uppercase text-cyan-400 tracking-wider">
                    {pillar.area}
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl font-medium text-white group-hover:text-cyan-300 transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    {pillar.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          ACADEMIC GROUNDING & FUTURE RESEARCH
          ======================================================== */}
      <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
            ACADEMIC GROUNDING & FUTURE DIRECTIONS
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-light text-white mt-2 mb-3">
            Theoretical Literature vs. Practical Prototype
          </h2>
          <p className="text-xs text-slate-400 font-light max-w-xl mx-auto">
            Existing research explores provable data possession (PDP), third-party auditors (TPA), and blockchain smart contracts. This project investigates a lightweight prototype focused on tangible version tracking.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border-slate-800">
            <h3 className="font-serif text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-400" />
              Honest Engineering Limitations
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-mono">•</span>
                <span><strong>Simulated Cloud Storage:</strong> Files are stored in a dedicated local directory hierarchy. Commercial APIs (AWS S3, Azure) are not invoked.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-mono">•</span>
                <span><strong>Full-File Streaming:</strong> Streams SHA-256 over 1 MB chunks for exact verification rather than random block sampling (PDP).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-mono">•</span>
                <span><strong>Key Isolation:</strong> The secret key is stored in the environment outside SQLite, avoiding database recalculation vulnerabilities.</span>
              </li>
            </ul>
          </div>

          <div className="glass-panel p-6 sm:p-8 rounded-3xl border-slate-800">
            <h3 className="font-serif text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              Academic Credentials & Institutional Attribution
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Developed as a major B.Tech project under the Department of Computer Science and Engineering at Bharat Ratna Babasaheb Bhimrao Ambedkar Rajkiya Engineering College, Pratapgarh.
            </p>
            <div className="text-[11px] font-mono text-cyan-400 flex flex-wrap gap-4 pt-3 border-t border-slate-800">
              <span>Supervised by: Dr. Ashish Kumar Mishra</span>
              <span>Students: Ayush Agnihotri & Vivek Kushwaha</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          EDITORIAL FOOTER / CTA
          ======================================================== */}
      <footer className="py-20 px-6 sm:px-8 bg-slate-950/60 border-t border-slate-800/80 text-center backdrop-blur-md">
        <div className="max-w-3xl mx-auto space-y-6">
          <span className="text-xs uppercase tracking-[0.3em] font-mono text-cyan-400">
            AUDITING MECHANISM IN CLOUD DATA SERVICES
          </span>
          <h2 className="font-serif text-3xl md:text-5xl font-light text-white">
            Verify Your Cloud Integrity Today
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-light max-w-lg mx-auto leading-relaxed">
            Experience tamper-evident cloud data services with verifiable version tracking, dynamic re-upload HMAC hash chaining, and real-time forensic auditing.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/upload"
              className="px-8 py-3.5 bg-white text-slate-950 rounded-full text-xs uppercase tracking-widest font-semibold hover:bg-cyan-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Start File Ingestion / Re-upload
            </Link>
            <Link
              to="/dashboard"
              className="px-8 py-3.5 bg-slate-900 text-white border border-slate-700 rounded-full text-xs uppercase tracking-widest font-semibold hover:bg-slate-800 transition-all"
            >
              View System Telemetry
            </Link>
          </div>
        </div>
      </footer>
      </CloudBackground>
    </div>
  );
}

export default HomePage;
