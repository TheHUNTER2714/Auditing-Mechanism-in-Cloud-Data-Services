import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Layers, 
  Activity, 
  AlertTriangle, 
  Server, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Database,
  ArrowRight,
  FileText,
  Clock,
  Key,
  Flame,
  Info
} from 'lucide-react';

interface StorySectionsProps {
  stats: any;
}

export const StorySections: React.FC<StorySectionsProps> = ({ stats }) => {
  // Interactive hash chain visual state
  const [chainSimValid, setChainSimValid] = useState<boolean>(true);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  return (
    <div className="space-y-28 py-16 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* SECTION 1: Why Cloud Data Auditing Matters */}
      <section id="why-auditing" className="space-y-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
            THE MOTIVATION & PROBLEM STATEMENT
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-light text-white mt-2 mb-4">
            Why Cloud Data Auditing Matters
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light">
            When organizations outsource data to third-party cloud data services, physical control over hardware is relinquished. Without independent verification, silent corruption and unauthorized tampering can occur unnoticed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-panel rounded-2xl p-6 border-slate-800 hover:border-cyan-400/40 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4 group-hover:scale-110 transition-transform">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-medium text-white mb-2">1. Data Integrity</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              How do you know the data stored in the cloud hasn't suffered silent bit rot, drive degradation, or unauthorized tampering without downloading gigabytes of raw files?
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6 border-slate-800 hover:border-blue-400/40 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-4 group-hover:scale-110 transition-transform">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-medium text-white mb-2">2. Activity Monitoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              How can cloud tenants distinguish between a legitimate authorized document revision by an owner versus an untracked, malicious modification by an internal or external attacker?
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6 border-slate-800 hover:border-indigo-400/40 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4 group-hover:scale-110 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-medium text-white mb-2">3. Audit History</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              What guarantees that historical versions haven't been retroactively modified or deleted to conceal compliance breaches, regulatory violations, or operational anomalies?
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6 border-slate-800 hover:border-red-400/40 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 mb-4 group-hover:scale-110 transition-transform">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-medium text-white mb-2">4. Tamper Detection</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Can the system detect both physical storage corruption on disk and subtle database alterations such as rolled-back version heads or modified audit ledgers?
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: Cloud Infrastructure Flow */}
      <section className="glass-panel rounded-3xl p-8 sm:p-12 border-cyan-500/20 relative overflow-hidden">
        <div className="max-w-3xl mb-8">
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
            DYNAMIC DATA FLOW ARCHITECTURE
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-light text-white mt-1">
            Data Auditing Pipeline in Cloud Services
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-light">
            In modern cloud computing, users delegate storage to service providers where direct physical access is absent. The auditing mechanism acts as a verifiable verification bridge.
          </p>
        </div>

        {/* Animated Sequence Pipeline */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 relative">
          {[
            { step: '01', title: 'Data Owner / User', desc: 'Initiates upload or update', icon: FileText, color: 'text-cyan-400' },
            { step: '02', title: 'Cloud Data Service', desc: 'Receives multipart payload', icon: Server, color: 'text-blue-400' },
            { step: '03', title: 'Simulated Storage', desc: 'Persists active bytes & blobs', icon: Database, color: 'text-indigo-400' },
            { step: '04', title: 'Cryptographic Engine', desc: 'Computes SHA-256 & HMAC', icon: Key, color: 'text-emerald-400' },
            { step: '05', title: 'Verification Engine', desc: 'Rechecks chain & receipts', icon: Shield, color: 'text-cyan-300' },
            { step: '06', title: 'Verifiable Verdict', desc: 'PASS / TAMPERED / ALTERED', icon: CheckCircle2, color: 'text-emerald-300' },
          ].map((item, idx) => (
            <div key={idx} className="rounded-xl bg-[#07111F] p-4 border border-slate-800 relative group hover:border-cyan-500/40 transition-all">
              <div className="flex justify-between items-center mb-3">
                <span className="font-mono text-[10px] text-slate-500">{item.step}</span>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="font-serif font-semibold text-white text-xs mb-1">{item.title}</div>
              <div className="text-[10px] text-slate-400 leading-tight">{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl bg-slate-900/60 p-4 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
          <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Security Model Notice:</strong> Cloud clients do not trust the cloud server blindly. By retaining a cryptographic receipt locally, the client can detect if the server rolls back to a previous valid state or tampers with the history ledger.
          </div>
        </div>
      </section>

      {/* SECTION 3: Research Context & Academic Taxonomy */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
            LITERATURE TAXONOMY & RESEARCH GAP
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-light text-white mt-2 mb-4">
            From Complex Auditing Research to a Practical Prototype
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light">
            Existing academic research is extensive and mathematically advanced. This B.Tech prototype explores a lightweight, practical approach focused on tangible version tracking and integrity verification.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Theoretical Research Paradigms */}
          <div className="lg:col-span-7 space-y-3">
            <h3 className="font-serif text-sm font-semibold uppercase text-slate-300 tracking-wider mb-2">
              Advanced Existing Research (Literature Spectrum)
            </h3>
            
            <div className="space-y-2 text-xs">
              <div className="rounded-xl bg-[#07111F] p-3.5 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-white">Provable Data Possession (PDP) & POR</span>
                  <span className="font-mono text-[10px] text-cyan-400">Sampling & Erasure Coding</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Ateniese et al. and Juels et al. proposed spot-checking random data blocks using homomorphic authenticators without downloading the full dataset.
                </p>
              </div>

              <div className="rounded-xl bg-[#07111F] p-3.5 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-white">Third-Party Auditing (TPA) & Privacy-Preserving</span>
                  <span className="font-mono text-[10px] text-blue-400">Zero-Knowledge Proofs</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Wang et al. introduced public auditing via TPAs with random masking to prevent the auditor from learning data content.
                </p>
              </div>

              <div className="rounded-xl bg-[#07111F] p-3.5 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-white">Dynamic Auditing with Merkle Trees & Skip Lists</span>
                  <span className="font-mono text-[10px] text-indigo-400">Index Tables</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Supports file modification, insertion, and deletion using authenticated data structures such as Merkle Hash Trees.
                </p>
              </div>

              <div className="rounded-xl bg-[#07111F] p-3.5 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-white">Blockchain-Assisted & Identity-Based Auditing</span>
                  <span className="font-mono text-[10px] text-amber-400">Smart Contracts & PKI-Free</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Eliminates central TPA trust using decentralized smart contracts and identity-based signatures.
                </p>
              </div>
            </div>
          </div>

          {/* Practical Prototype Focus Block */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-6 border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <span className="rounded-full bg-cyan-950/80 border border-cyan-400/40 px-3 py-1 text-[10px] font-mono text-cyan-300 uppercase tracking-wider mb-4 inline-block">
              Practical Prototype Focus
            </span>
            <h3 className="font-serif text-xl font-bold text-white mb-3">
              Version-Based Dynamic Cloud Data Auditing
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Rather than requiring complex bilinear pairings or expensive blockchain gas fees, this prototype implements a transparent, verifiable engine:
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span><strong>Data Integrity:</strong> Full-payload streaming SHA-256 digest verification.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span><strong>Dynamic Updates:</strong> Automatic V(n+1) block derivation on authorized update.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span><strong>Historical Continuity:</strong> Secret-anchored HMAC-SHA256 version chaining.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span><strong>Change Detection:</strong> Real-time alerts for disk tampering and database alteration.</span>
              </li>
            </ul>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-cyan-400">
              Existing research is extensive; this prototype explores a practical, lightweight approach.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: The Version-Based Model Visual */}
      <section className="glass-panel rounded-3xl p-8 sm:p-10 border-slate-800">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
            CRYPTOGRAPHIC FORMULATION
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-light text-white mt-1">
            Mathematical Version-Chain Formulation
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-light">
            Every version block is sealed with an unexposed server secret key using HMAC-SHA256:
          </p>
        </div>

        {/* Formula Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800 text-center font-mono">
            <div className="text-[11px] text-slate-500 mb-1">Content Digest Formulation</div>
            <div className="text-sm font-semibold text-cyan-300">
              D_v = SHA-256(File Bytes)
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Chunked 1 MB streaming</div>
          </div>

          <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800 text-center font-mono">
            <div className="text-[11px] text-slate-500 mb-1">Genesis Block Anchor</div>
            <div className="text-sm font-semibold text-blue-300">
              HC_0 = HMAC(K, "genesis|" + id)
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Bound to file identity</div>
          </div>

          <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800 text-center font-mono">
            <div className="text-[11px] text-slate-500 mb-1">Version Block Chaining</div>
            <div className="text-sm font-semibold text-emerald-300">
              HC_v = HMAC(K, id|v|D_v|HC_prev|t)
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Fixed UTC ISO timestamp</div>
          </div>
        </div>

        {/* Interactive Version Node Graph Preview */}
        <div className="rounded-2xl bg-[#030611] p-6 border border-slate-800 relative">
          <div className="text-xs font-mono text-slate-400 mb-4 flex justify-between items-center">
            <span>LIVE CHAIN LINKAGE VISUALIZER</span>
            <span className="text-cyan-400">Hover nodes to inspect block metadata</span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 overflow-x-auto">
            {[
              { v: 1, c: 'd5a4e819...', p: 'HC_0 (Genesis)', h: '8f12a0e4...', act: 'UPLOAD', t: '2026-09-29T10:00:00Z' },
              { v: 2, c: '7c2b04f1...', p: '8f12a0e4... (HC_1)', h: '3b9d7e12...', act: 'AUTHORIZED_UPDATE', t: '2026-09-29T10:15:00Z' },
              { v: 3, c: 'e810a9c2...', p: '3b9d7e12... (HC_2)', h: '4f88c3a7...', act: 'AUTHORIZED_UPDATE', t: '2026-09-29T10:30:00Z' },
              { v: 4, c: '99d45e6f...', p: '4f88c3a7... (HC_3)', h: '1a50b892...', act: 'HEAD VERSION', t: '2026-09-29T10:45:00Z' },
            ].map((node) => (
              <React.Fragment key={node.v}>
                <div
                  onMouseEnter={() => setHoveredNode(node.v)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`relative cursor-pointer rounded-xl p-4 border transition-all ${
                    hoveredNode === node.v
                      ? 'bg-cyan-950/40 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                      : 'bg-[#07111F] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2 font-mono">
                    <span className="rounded bg-cyan-500/20 text-cyan-300 px-2 py-0.5 text-xs font-bold">
                      V{node.v}
                    </span>
                    <span className="text-[10px] text-slate-400">{node.act}</span>
                  </div>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="text-slate-400">Digest: <span className="text-slate-200">{node.c}</span></div>
                    <div className="text-slate-400">HC: <span className="text-cyan-400 font-semibold">{node.h}</span></div>
                  </div>

                  {/* Tooltip on Hover */}
                  {hoveredNode === node.v && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-slate-900/95 border border-cyan-400 p-3 text-[11px] font-mono text-slate-300 shadow-2xl z-30 pointer-events-none">
                      <div className="font-bold text-white mb-1">Block Details: Version {node.v}</div>
                      <div>Previous: {node.p}</div>
                      <div>Timestamp: {node.t}</div>
                      <div>Status: Sealed with HMAC key</div>
                    </div>
                  )}
                </div>

                {node.v < 4 && (
                  <div className="hidden md:flex items-center text-cyan-500/60 font-mono text-xs">
                    <ArrowRight className="h-4 w-4 animate-pulse" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: Live Interactive Hash Chain Animation with Break/Snap */}
      <section className="glass-panel rounded-3xl p-8 sm:p-10 border-cyan-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono font-semibold">
              DYNAMIC LINKAGE SIMULATION
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-light text-white mt-1">
              Live Hash-Chain Verification State
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setChainSimValid(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-mono transition-all ${
                chainSimValid
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Simulate Valid Chain
            </button>
            <button
              onClick={() => setChainSimValid(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-mono transition-all ${
                !chainSimValid
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Simulate Broken Link
            </button>
          </div>
        </div>

        {/* Visual Chain Representation */}
        <div className={`rounded-2xl p-6 border transition-all ${
          chainSimValid 
            ? 'bg-[#030611] border-emerald-500/30' 
            : 'bg-red-950/20 border-red-500/40'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-mono text-xs">
              {chainSimValid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">VERSION HISTORY VALID</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-400" />
                  <span className="text-red-400 font-bold">VERSION HISTORY ALTERED (BROKEN AT V2)</span>
                </>
              )}
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              {chainSimValid ? 'All signatures match secret HMAC' : 'Attacker forged content without secret'}
            </span>
          </div>

          {/* Links Visualization */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 py-4">
            <div className="rounded-lg bg-[#07111F] p-3 border border-slate-700 font-mono text-xs text-center w-28">
              <div className="text-cyan-400 font-bold">V1</div>
              <div className="text-[10px] text-slate-400">Genesis</div>
            </div>

            <div className={`h-0.5 w-12 sm:w-16 transition-all ${
              chainSimValid ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-700'
            }`} />

            <div className={`rounded-lg p-3 border font-mono text-xs text-center w-28 transition-all ${
              chainSimValid 
                ? 'bg-[#07111F] border-slate-700' 
                : 'bg-red-950/60 border-red-500 text-red-300 animate-pulse'
            }`}>
              <div className={chainSimValid ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'}>
                V2
              </div>
              <div className="text-[10px] text-slate-400">
                {chainSimValid ? 'Authorized' : 'Tampered'}
              </div>
            </div>

            <div className={`h-0.5 w-12 sm:w-16 transition-all ${
              chainSimValid ? 'bg-blue-400 shadow-[0_0_8px_#3b82f6]' : 'border-t-2 border-dashed border-red-500'
            }`} />

            <div className="rounded-lg bg-[#07111F] p-3 border border-slate-700 font-mono text-xs text-center w-28">
              <div className="text-slate-300 font-bold">V3</div>
              <div className="text-[10px] text-slate-400">Head Block</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: Limitations Panel */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 border-slate-800">
        <div className="flex items-center gap-2 text-white font-serif font-semibold text-lg mb-2">
          <HelpCircle className="h-5 w-5 text-cyan-400" />
          Prototype Limitations & Academic Grounding
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          To maintain transparency and honest academic framing, the following boundaries define this B.Tech prototype:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800">
            <span className="font-mono text-cyan-400 font-semibold block mb-1">Simulated Cloud Storage</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Files reside in a local file-system hierarchy simulating multi-tenant cloud storage. Commercial APIs (AWS S3, Azure Blob) are not invoked.
            </p>
          </div>

          <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800">
            <span className="font-mono text-cyan-400 font-semibold block mb-1">Full-File Hashing vs. PDP Sampling</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Verification computes SHA-256 across the full payload by streaming 1 MB chunks. Unlike sampling-based PDP, full hashing requires inspecting the whole file.
            </p>
          </div>

          <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800">
            <span className="font-mono text-cyan-400 font-semibold block mb-1">Secret Key Management</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              The <code className="text-cyan-300">CHAIN_SECRET</code> is isolated outside SQLite in the environment. In production, a Hardware Security Module (HSM) or KMS would anchor this key.
            </p>
          </div>

          <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800">
            <span className="font-mono text-cyan-400 font-semibold block mb-1">Identity & Authentication Scope</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              User logins and RBAC are omitted for prototype clarity. Authorized updates are designated by invoking the designated update API endpoint.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
