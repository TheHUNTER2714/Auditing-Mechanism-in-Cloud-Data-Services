import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Shield, 
  Database, 
  Layers, 
  Play, 
  RotateCcw,
  Server,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  UserCheck,
  Users,
  Compass,
  FileText,
  Cpu,
  BookOpen,
  Terminal,
  ExternalLink,
  ChevronRight,
  Sparkles,
  KeyRound,
  FileCode2
} from 'lucide-react';
import { PublicNavbar } from '../components/PublicNavbar';
import { IntroSequence } from '../components/IntroSequence';
import { DataCenterScene } from '../components/DataCenterScene';
import { CloudBackground } from '../components/CloudBackground';

export const LandingPage: React.FC = () => {
  // Logo intro starts first on page load, then cleanly resets/fades into landing page
  const [showIntro, setShowIntro] = useState<boolean>(true);

  return (
    <div className="min-h-screen bg-[#02040A] text-[#F1F5F9] flex flex-col overflow-x-hidden">
      <PublicNavbar />

      {/* Intro Sequence Overlay (Starts first, can be reset/replayed anytime) */}
      <AnimatePresence>
        {showIntro && (
          <IntroSequence onComplete={() => setShowIntro(false)} />
        )}
      </AnimatePresence>

      {/* Floating Replay / Reset Intro Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowIntro(true)}
          className="flex items-center gap-2 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 px-4 py-2.5 text-xs font-mono text-slate-200 hover:text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)] backdrop-blur-md transition-all cursor-pointer hover:scale-105"
          title="Reset and replay the introductory logo sequence"
        >
          <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
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
            <a
              href="#about"
              className="rounded-full bg-slate-900/90 border border-slate-700 hover:border-cyan-400/50 text-slate-300 hover:text-white px-6 py-3.5 text-xs uppercase tracking-wider font-mono transition-all backdrop-blur-md"
            >
              About Project ↓
            </a>
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
      <CloudBackground id="foundations" className="py-24 px-6 md:px-12 border-t border-slate-800/80">
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
        </div>
      </CloudBackground>

      {/* ========================================================
          3. ABOUT THE PROJECT SECTION (RESEARCH & METHODOLOGY)
          ======================================================== */}
      <section id="about" className="py-24 px-6 md:px-12 bg-[#02050E] border-t border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Section Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-950/60 border border-cyan-400/40 px-3.5 py-1 text-xs font-mono text-cyan-300">
              <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
              <span>RESEARCH PAPER SYNOPSIS & MOTIVATION</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl font-light text-white tracking-tight leading-tight">
              About the Project: Dynamic Cloud Data Auditing
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light max-w-3xl">
              Addressing the fundamental trust boundaries of third-party cloud data outsourcing through continuous cryptographic verification, dynamic version tracking, and deterministic attack forensics.
            </p>
          </div>

          {/* Deep Narrative Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* The Core Cloud Storage Dilemma */}
            <div className="glass-panel p-8 rounded-3xl border-slate-800/80 space-y-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-white">
                The Cloud Storage Trust Problem
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                When enterprise data is outsourced to multi-tenant cloud data services, data owners surrender physical custody of the underlying storage media. Organizations face three pervasive security risks:
              </p>
              <ul className="space-y-2 text-xs text-slate-400 font-light">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>Silent Bit Rot:</strong> Physical drive degradation that storage controllers silently fail to recover.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>Unauthorized Overwriting:</strong> Malicious or accidental in-place modifications bypassing access controls.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>Silent Rollback Attacks:</strong> Rogue cloud servers restoring stale versions to conceal data loss or breach events.</span>
                </li>
              </ul>
            </div>

            {/* Why Legacy Schemes Fail */}
            <div className="glass-panel p-8 rounded-3xl border-slate-800/80 space-y-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 w-fit">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-white">
                Limitations of Static Auditing
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                Pioneering protocols like Provable Data Possession (PDP) and Proof of Retrievability (PoR) were designed almost exclusively for <strong>static, read-only archives</strong>.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                When applied to modern dynamic cloud data services where files undergo continuous revisions, block insertions, and append operations, traditional static schemes either require prohibitive re-computation costs (re-tagging all blocks) or remain vulnerable to replay and snapshot rollbacks.
              </p>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-rose-300">
                Static PDP/PoR ↛ Dynamic Re-upload Security
              </div>
            </div>

            {/* The V-DCA Paradigm */}
            <div className="glass-panel p-8 rounded-3xl border-cyan-500/30 space-y-4 shadow-[0_0_25px_rgba(34,211,238,0.1)]">
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 w-fit">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-white">
                The Proposed V-DCA Solution
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                The <strong>Version-Based Dynamic Cloud Data Auditing</strong> protocol establishes mathematical accountability over simulated cloud data services without heavy bilinear pairing overhead.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                By chaining HMAC-SHA256 signatures with fixed UTC ISO timestamps, unexposed server secrets, and client-held verification receipts, V-DCA achieves lightweight, non-interactive verification with sub-second execution speeds.
              </p>
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-400/30 text-[11px] font-mono text-cyan-300">
                Deterministic Dual-Layer Auditing Architecture
              </div>
            </div>
          </div>

          {/* Operational Workflow Card */}
          <div className="glass-panel p-8 sm:p-10 rounded-3xl border-slate-800/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
                  AUDITING METHODOLOGY & PROTOCOL PHASES
                </span>
                <h3 className="font-serif text-2xl text-white font-medium mt-1">
                  How the Verification Engine Operates
                </h3>
              </div>
              <Link
                to="/overview"
                className="inline-flex items-center gap-2 text-xs font-mono text-cyan-300 hover:text-cyan-200 transition-colors w-fit"
              >
                <span>View Mathematical Formulations</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
              <div className="space-y-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">1</span>
                  <span>Ingestion ($V_1$)</span>
                </div>
                <p className="text-slate-400 font-light leading-relaxed">
                  Streams 1 MB chunks to derive D₁ = SHA-256(file bytes) and initializes genesis signature HC₀ = HMAC(K_chain, &quot;genesis|&quot; + file_id).
                </p>
              </div>

              <div className="space-y-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="font-mono text-blue-400 font-semibold flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px]">2</span>
                  <span>Dynamic Update</span>
                </div>
                <p className="text-slate-400 font-light leading-relaxed">
                  Calculates D_(n+1) and binds HC_(n+1) = HMAC(K_chain, file_id | v | D_(n+1) | HC_n | UTC), appending to the SQLite version vector.
                </p>
              </div>

              <div className="space-y-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="font-mono text-indigo-400 font-semibold flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">3</span>
                  <span>Receipt Issuance</span>
                </div>
                <p className="text-slate-400 font-light leading-relaxed">
                  Client receives and pins an unforgeable cryptographic receipt in browser storage, guaranteeing evidence against future rollback attempts.
                </p>
              </div>

              <div className="space-y-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">4</span>
                  <span>Precedence Audit</span>
                </div>
                <p className="text-slate-400 font-light leading-relaxed">
                  Verifies database chain continuity first (V₁ ... V_n). Then streams active disk payload to confirm physical bits match D_latest.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          4. PROJECT INFO & ACADEMIC CREDENTIALS SECTION
          ======================================================== */}
      <section id="project-info" className="py-24 px-6 md:px-12 bg-[#010309] border-t border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Section Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/60 border border-blue-400/40 px-3.5 py-1 text-xs font-mono text-blue-300">
              <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
              <span>PROJECT INFO & ACADEMIC GOVERNANCE</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl font-light text-white tracking-tight leading-tight">
              Project Information & Academic Metadata
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light max-w-3xl">
              Official institutional credentials, academic investigators, supervisor attributions, and technical implementation specifications for the B.Tech Major Capstone Project.
            </p>
          </div>

          {/* Official Problem Statement Box (Exact Required String) */}
          <div className="glass-panel p-8 sm:p-10 rounded-3xl border-cyan-500/40 space-y-4 shadow-[0_0_35px_rgba(34,211,238,0.12)]">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest font-semibold">
              <Compass className="h-4 w-4" />
              <span>Official Research Problem Statement</span>
            </div>
            <blockquote className="border-l-4 border-cyan-400 pl-6 py-2 text-2xl sm:text-3xl font-serif italic text-white leading-snug">
              "To Propose A Novel Auditing Mechanism In Cloud Data Services."
            </blockquote>
            <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed pt-2">
              Formulated to address the urgent requirement for high-throughput, lightweight, and tamper-resilient integrity auditing in modern outsourced cloud data storage systems.
            </p>
          </div>

          {/* Academic & Investigator Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Project Identity */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 w-fit">
                <FileCode2 className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-base font-semibold text-white">Project Identity</h3>
              <div className="space-y-2 text-xs font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Title:</span>
                  <span className="text-white font-medium">Auditing Mechanism in Cloud Data Services</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Model Name:</span>
                  <span className="text-cyan-400">Version-Based Dynamic Cloud Data Auditing</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Classification:</span>
                  <span>Major B.Tech Capstone Project</span>
                </div>
              </div>
            </div>

            {/* Card 2: Academic Institution */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 w-fit">
                <GraduationCap className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-base font-semibold text-white">Academic Institution</h3>
              <div className="space-y-2 text-xs font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">College:</span>
                  <span className="text-white leading-tight block">REC Pratapgarh</span>
                  <span className="text-[10px] text-slate-400">Bharat Ratna Babasaheb Bhimrao Ambedkar REC</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Department:</span>
                  <span className="text-blue-300">Computer Science & Engineering</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Academic Year:</span>
                  <span>Class of 2026</span>
                </div>
              </div>
            </div>

            {/* Card 3: Project Mentorship */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 w-fit">
                <UserCheck className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-base font-semibold text-white">Supervisor / Guide</h3>
              <div className="space-y-2 text-xs font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Faculty Mentor:</span>
                  <span className="text-white font-medium text-sm">Dr. Ashish Kumar Mishra</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Department:</span>
                  <span>Computer Science & Engineering</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Research Domain:</span>
                  <span className="text-indigo-300">Cloud Data Security & Integrity Auditing</span>
                </div>
              </div>
            </div>

            {/* Card 4: Student Investigators */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-base font-semibold text-white">Student Investigators</h3>
              <div className="space-y-3 text-xs font-mono text-slate-300">
                <div className="border-b border-slate-800/80 pb-2">
                  <div className="text-white font-medium">Ayush Agnihotri</div>
                  <div className="text-slate-400 text-[11px]">Roll No: 2312160100022</div>
                  <div className="text-[10px] text-emerald-400">Core Engine & UI Architecture</div>
                </div>
                <div>
                  <div className="text-white font-medium">Vivek Kushwaha</div>
                  <div className="text-slate-400 text-[11px]">Roll No: 2312160100071</div>
                  <div className="text-[10px] text-emerald-400">Storage & Forensic Ledger</div>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Implementation Stack Pill Grid */}
          <div className="p-8 rounded-3xl bg-slate-950/60 border border-slate-800/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
                  SYSTEM IMPLEMENTATION SPECIFICATIONS
                </span>
                <h4 className="font-serif text-xl text-white font-medium mt-1">
                  Engineered for Performance & Mathematical Soundness
                </h4>
              </div>
              <div className="text-xs font-mono text-slate-400">
                13 Automated Pytest Verifications • Zero Pairing Setup
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Backend</div>
                <div className="text-xs font-semibold text-white mt-1">Python 3.11+ / Flask</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Database</div>
                <div className="text-xs font-semibold text-cyan-300 mt-1">SQLite (WAL Mode)</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Frontend</div>
                <div className="text-xs font-semibold text-white mt-1">React 18 / Vite / TS</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Styling</div>
                <div className="text-xs font-semibold text-blue-300 mt-1">Tailwind CSS v4</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Crypto Primitive</div>
                <div className="text-xs font-semibold text-emerald-300 mt-1">HMAC-SHA256</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Stream Buffer</div>
                <div className="text-xs font-semibold text-white mt-1">1 MB Chunk Hashing</div>
              </div>
            </div>

            {/* Quick Action Hub */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-400 font-light">
                Ready to review the mathematical formulations, protocol security proofs, and live audit demonstrations?
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/overview"
                  className="px-6 py-2.5 rounded-full bg-cyan-400 text-slate-950 text-xs font-semibold uppercase tracking-wider hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center gap-1.5"
                >
                  <span>Project Overview</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-white text-xs font-semibold uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center gap-1.5"
                >
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Launch Console</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. MINIMAL PUBLIC FOOTER
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
        <div className="pt-2 text-slate-600 text-[10px]">
          Investigators: Ayush Agnihotri (2312160100022) • Vivek Kushwaha (2312160100071)
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
