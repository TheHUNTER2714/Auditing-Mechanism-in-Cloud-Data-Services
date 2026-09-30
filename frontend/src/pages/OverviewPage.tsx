import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Layers, 
  Database, 
  Server, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Code,
  Compass,
  FileCheck,
  Terminal,
  Activity,
  Lock,
  Cpu
} from 'lucide-react';
import { PublicNavbar } from '../components/PublicNavbar';
import { CloudBackground } from '../components/CloudBackground';

export const OverviewPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#02040A] text-[#F1F5F9] flex flex-col">
      <PublicNavbar />

      <CloudBackground className="pt-24 pb-20 px-6 sm:px-8 flex-1">
        <div className="max-w-5xl mx-auto space-y-16">
          {/* Header */}
          <div className="space-y-4 border-b border-slate-800 pb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-950/60 border border-cyan-400/40 px-3.5 py-1 text-xs font-mono text-cyan-300">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>RESEARCH PAPER SPECIFICATION & SPEC SHEET</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
              Project Overview: Dynamic Cloud Data Auditing
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light max-w-3xl">
              A comprehensive technical breakdown of the <strong>Version-Based Dynamic Cloud Data Auditing (V-DCA)</strong> architecture, cryptographic formulations, protocol workflows, and experimental methodology.
            </p>
          </div>

          {/* 1. Problem Statement (EXACT REQUIRED STRING) */}
          <section className="glass-panel p-6 sm:p-8 rounded-3xl border-cyan-500/30 space-y-4 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <div className="flex items-center gap-2.5 text-xs font-mono text-cyan-400 uppercase tracking-widest font-semibold">
              <Compass className="h-4 w-4" />
              <span>Official Problem Statement</span>
            </div>
            <blockquote className="border-l-4 border-cyan-400 pl-4 py-1 text-xl sm:text-2xl font-serif italic text-white leading-snug">
              "To Propose A Novel Auditing Mechanism In Cloud Data Services."
            </blockquote>
            <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
              When physical data storage is delegated to remote cloud service providers, data owners lose direct physical governance. Traditional auditing schemes either assume static, read-only archives (Provable Data Possession / Proof of Retrievability) or impose prohibitive computational overhead during dynamic re-uploads and block updates. Furthermore, untrusted cloud providers may execute rollback attacks, reverting to historical versions to conceal silent bit rot or catastrophic hardware failures.
            </p>
          </section>

          {/* 2. Objectives */}
          <section className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-white flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Core Research Objectives
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <span className="font-mono text-cyan-400 font-semibold">1. Continuous Dynamic Integrity</span>
                <p className="text-slate-300 leading-relaxed">
                  Provide continuous verification for both initial baseline uploads and dynamic re-upload events without downloading the full file to client workstations.
                </p>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <span className="font-mono text-blue-400 font-semibold">2. Anti-Rollback Guarantee</span>
                <p className="text-slate-300 leading-relaxed">
                  Issue unforgeable client-held cryptographic receipts that pin the latest authorized version index, detecting server-side snapshot rollbacks instantaneously.
                </p>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <span className="font-mono text-indigo-400 font-semibold">3. Deterministic Precedence Forensics</span>
                <p className="text-slate-300 leading-relaxed">
                  Establish strict diagnostic order: verify database version hash chain continuity first, then stream physical storage blocks to separate disk corruption from database tampering.
                </p>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <span className="font-mono text-emerald-400 font-semibold">4. Lightweight Non-Pairing Efficiency</span>
                <p className="text-slate-300 leading-relaxed">
                  Avoid computationally prohibitive bilinear pairings and complex zero-knowledge setup delays by relying on keyed HMAC-SHA256 primitives and Merkle Hash Trees.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Proposed Approach & V-DCA Model */}
          <section className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-white flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-cyan-400" />
              The Proposed Approach & V-DCA Model
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
              The <strong>Version-Based Dynamic Cloud Data Auditing (V-DCA)</strong> model introduces a dual-layer authentication hierarchy:
            </p>

            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-[#030611] border border-slate-800 space-y-3 font-mono text-xs">
                <div className="text-cyan-400 font-semibold uppercase tracking-wider">
                  Mathematical Cryptographic Primitives:
                </div>
                <div className="space-y-2 text-slate-300">
                  <div>
                    <span className="text-slate-500">Block Anti-Forgery Tag:</span>{' '}
                    <code className="text-cyan-300">T_(i,v) = HMAC(K_tag, file_id || v || i || SHA256(block_i))</code>
                  </div>
                  <div>
                    <span className="text-slate-500">Merkle Tree Root:</span>{' '}
                    <code className="text-cyan-300">R_v = MerkleRoot(SHA256(block_0), ..., SHA256(block_n-1))</code>
                  </div>
                  <div>
                    <span className="text-slate-500">Version Hash Chain:</span>{' '}
                    <code className="text-cyan-300">HC_v = HMAC(K_chain, HC_(v-1) || D_v || R_v || v || timestamp)</code>
                  </div>
                  <div>
                    <span className="text-slate-500">Genesis Anchor:</span>{' '}
                    <code className="text-cyan-300">HC_0 = HMAC(K_chain, file_id || "GENESIS")</code>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Architecture & System Entities */}
          <section className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-white flex items-center gap-2.5">
              <Server className="h-5 w-5 text-blue-400" />
              System Architecture & Participant Entities
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="font-mono text-cyan-400 font-semibold">1. Data Owner (Client)</div>
                <p className="text-slate-400 leading-relaxed font-light">
                  Generates initial file payload, computes blinded ownership tags, initiates dynamic block updates, and stores unforgeable verification receipts.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="font-mono text-blue-400 font-semibold">2. Cloud Storage Server</div>
                <p className="text-slate-400 leading-relaxed font-light">
                  Simulated local storage directory holding current active files, immutable version archives, and computing Merkle tree audit paths.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="font-mono text-indigo-400 font-semibold">3. Third-Party Auditor (TPA)</div>
                <p className="text-slate-400 leading-relaxed font-light">
                  Issues public randomness challenges to spot-check sampled blocks without gaining raw file download access (privacy-preserving).
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="font-mono text-emerald-400 font-semibold">4. Simulated Ledger</div>
                <p className="text-slate-400 leading-relaxed font-light">
                  An append-only blockchain ledger recording sequence number, previous block hash, timestamp, and audit verdicts in SQLite.
                </p>
              </div>
            </div>
          </section>

          {/* 5. How It Works */}
          <section className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-white flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-indigo-400" />
              How It Works: Step-by-Step Protocol Flow
            </h2>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#030611] border border-slate-800">
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">STAGE 1</span>
                <div>
                  <strong className="text-white block mb-0.5">Initial Payload Ingestion (V1)</strong>
                  <span className="text-slate-400">File is partitioned into 64 KB blocks. SHA-256 is streamed to compute D_1 and Merkle Root R_1. Genesis chain hash HC_0 is created, and HC_1 is recorded in SQLite and returned as receipt.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#030611] border border-slate-800">
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-500/30">STAGE 2</span>
                <div>
                  <strong className="text-white block mb-0.5">Dynamic Updates (O(log n))</strong>
                  <span className="text-slate-400">Owner invokes dynamic operations (modify, insert, append, delete). Only the target block path in the Merkle tree is recomputed. V2 is created and bound to HC_1.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#030611] border border-slate-800">
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-500/30">STAGE 3</span>
                <div>
                  <strong className="text-white block mb-0.5">TPA Spot-Check & Challenge-Response</strong>
                  <span className="text-slate-400">Auditor queries public randomness seed from ledger head. Sampled block indices are audited against Wang et al. anti-forgery tags without revealing payload data to the TPA.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#030611] border border-slate-800">
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">STAGE 4</span>
                <div>
                  <strong className="text-white block mb-0.5">Precedence-Based Forensic Verification</strong>
                  <span className="text-slate-400">1. Verify HMAC version chain continuity from V1 to V_latest. 2. Verify client receipt match. 3. Stream disk bytes and compare SHA-256 against head hash. Returns PASS, TAMPERED, or VERSION_HISTORY_ALTERED.</span>
                </div>
              </div>
            </div>
          </section>

          {/* 6. Technology Stack */}
          <section className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-white flex items-center gap-2.5">
              <Code className="h-5 w-5 text-emerald-400" />
              Technology Stack
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="text-cyan-400 font-semibold uppercase">Frontend</div>
                <ul className="text-slate-300 space-y-1">
                  <li>• React 19 (TypeScript)</li>
                  <li>• Vite 8 Build Tool</li>
                  <li>• Tailwind CSS v4</li>
                  <li>• Framer Motion</li>
                  <li>• Recharts</li>
                  <li>• Lucide Icons</li>
                </ul>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="text-blue-400 font-semibold uppercase">Backend Engine</div>
                <ul className="text-slate-300 space-y-1">
                  <li>• Python 3.11+</li>
                  <li>• Flask REST API</li>
                  <li>• SQLite3 (Row Factory)</li>
                  <li>• Werkzeug Utilities</li>
                  <li>• Gunicorn WSGI</li>
                  <li>• Pytest Test Suite</li>
                </ul>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="text-indigo-400 font-semibold uppercase">Cryptographic Layer</div>
                <ul className="text-slate-300 space-y-1">
                  <li>• SHA-256 Hashing</li>
                  <li>• Keyed HMAC-SHA256</li>
                  <li>• Merkle Hash Trees</li>
                  <li>• Wang et al. 2024 Tags</li>
                  <li>• Public Randomness Seed</li>
                  <li>• JWT Session Tokens</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 7. Scope & Honest Engineering Limitations */}
          <section className="glass-panel p-6 sm:p-8 rounded-3xl border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-widest font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>Scope & Honest Engineering Limitations</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              In accordance with academic rigor, this prototype adheres to strict honest disclosure:
            </p>
            <ul className="space-y-2 text-xs text-slate-400 font-light">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-mono">•</span>
                <span><strong>Simulated Cloud Storage:</strong> Cloud storage is emulated using a local directory hierarchy (<code className="text-cyan-300 font-mono">storage/current</code> and <code className="text-cyan-300 font-mono">storage/versions</code>). Commercial APIs (AWS S3, Google Cloud Storage, Azure Blob) are deliberately not invoked to allow reproducible offline benchmarking.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-mono">•</span>
                <span><strong>Cryptographic Primitives:</strong> Implemented using SHA-256, HMAC, and Merkle trees. Bilinear pairing-based schemes, Boneh-Boyen short signatures, and identity-based cryptosystems are not claimed.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-mono">•</span>
                <span><strong>Ledger Implementation:</strong> The public audit ledger is an append-only hash-chained table within SQLite, emulating blockchain sequence and tamper verification without consensus transaction delays.</span>
              </li>
            </ul>
          </section>

          {/* 8. Future Work */}
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-semibold text-white flex items-center gap-2.5">
              <Terminal className="h-5 w-5 text-cyan-400" />
              Future Research Directions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="text-cyan-400 font-mono font-semibold">Erasure-Coded Multi-Cloud</div>
                <p className="text-slate-400 leading-relaxed font-light">
                  Extending the V-DCA model to Reed-Solomon erasure coding across multi-cloud federations for Byzantine fault tolerance.
                </p>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="text-blue-400 font-mono font-semibold">Zero-Knowledge Proofs (zk-SNARKs)</div>
                <p className="text-slate-400 leading-relaxed font-light">
                  Replacing Merkle path spot-check responses with succinct non-interactive zero-knowledge proofs to minimize verification bandwidth.
                </p>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="text-indigo-400 font-mono font-semibold">Decentralized Threshold Auditing</div>
                <p className="text-slate-400 leading-relaxed font-light">
                  Forming a federated threshold committee of independent TPAs to eliminate single-point audit reliance.
                </p>
              </div>
            </div>
          </section>

          {/* 9. Academic Attribution & CTA */}
          <div className="p-8 rounded-3xl bg-[#030611] border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-white font-serif font-semibold text-base">Academic Project Attribution</h3>
                <p className="text-xs text-slate-400">Department of Computer Science and Engineering • Class of 2026</p>
              </div>
              <div className="text-xs font-mono text-cyan-400">
                Major B.Tech Project
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-mono block">Project Guide & Supervisor:</span>
                <span className="text-white font-medium">Dr. Ashish Kumar Mishra</span>
              </div>
              <div>
                <span className="text-slate-500 font-mono block">Student Investigators:</span>
                <span className="text-white font-medium">Ayush Agnihotri & Vivek Kushwaha</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 font-mono block">Institution:</span>
                <span className="text-white font-medium">Bharat Ratna Babasaheb Bhimrao Ambedkar Rajkiya Engineering College, Pratapgarh</span>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-semibold text-xs uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all inline-flex items-center gap-2"
              >
                <span>Launch Application Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/"
                className="px-6 py-3 rounded-full bg-slate-900 border border-slate-700 text-white font-semibold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all"
              >
                Back to Public Landing
              </Link>
            </div>
          </div>
        </div>
      </CloudBackground>

      <footer className="py-8 px-6 bg-[#010206] border-t border-slate-800/80 text-center text-xs font-mono text-slate-500">
        Auditing Mechanism in Cloud Data Services • Version-Based Dynamic Cloud Data Auditing
      </footer>
    </div>
  );
};

export default OverviewPage;
