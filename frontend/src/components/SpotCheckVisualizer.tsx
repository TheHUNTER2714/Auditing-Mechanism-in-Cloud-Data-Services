import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, ShieldCheck, Cpu, ArrowUpRight, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import type { ChallengeResponse, ProofResponse, VerifyProofResult } from '../api/types';

interface SpotCheckVisualizerProps {
  fileId?: string;
  onAuditFinished?: () => void;
}

export const SpotCheckVisualizer: React.FC<SpotCheckVisualizerProps> = ({ fileId, onAuditFinished }) => {
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [proof, setProof] = useState<ProofResponse | null>(null);
  const [verdict, setVerdict] = useState<VerifyProofResult | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runSpotCheckChallenge = async () => {
    setLoading(true);
    setErrorMsg(null);
    setVerdict(null);
    setProof(null);
    setActiveStep(1);

    try {
      // 1. Request Challenge from unmanipulable public randomness
      const chal = await api.requestChallenge(fileId);
      setChallenge(chal);
      setActiveStep(2);

      // 2. Fetch Sampled Blocks + Merkle Proofs from Server
      const prf = await api.getProof(chal.file_id, chal.version, chal.challenged_indices);
      setProof(prf);
      setActiveStep(3);

      // 3. TPA Verifies Merkle Paths & Cryptographic Tags
      const res = await api.verifyProof(prf);
      setVerdict(res);
      setActiveStep(4);
      if (onAuditFinished) onAuditFinished();
    } catch (err: any) {
      setErrorMsg(err.message || 'Spot-check audit challenge failed');
    } finally {
      setLoading(false);
    }
  };

  const totalBlocks = challenge ? challenge.block_count : 16;
  const challengedSet = new Set(challenge ? challenge.challenged_indices : []);

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-cyan-500/25 p-5 sm:p-6 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-base font-semibold text-white tracking-tight">
              TPA Provable Data Possession (PDP) Spot-Check
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Non-pairing sampled Merkle path & anti-forgery tag verification
          </p>
        </div>

        <button
          type="button"
          onClick={runSpotCheckChallenge}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>Issue Challenge</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {/* Protocol Progress Stepper */}
      <div className="grid grid-cols-4 gap-2 mt-4 text-[10px] font-mono">
        {[
          { num: 1, label: 'Public Seed', desc: 'SHA256(Head | Epoch)' },
          { num: 2, label: 'Indices PRF', desc: 'Sampled Blocks' },
          { num: 3, label: 'Merkle Paths', desc: 'Server Proof' },
          { num: 4, label: 'TPA Verdict', desc: 'Ledger Recorded' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-2.5 rounded-xl border transition-all ${
              activeStep >= s.num
                ? 'bg-cyan-500/10 border-cyan-400/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                : 'bg-slate-950/40 border-slate-800 text-slate-500'
            }`}
          >
            <div className="font-bold">0{s.num}. {s.label}</div>
            <div className="text-[9px] text-slate-400 truncate">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Interactive 64 KB Block Matrix Grid */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span>64 KB Storage Block Matrix ({totalBlocks} Blocks)</span>
          {challenge && (
            <span className="text-cyan-300">
              Sampled: {challenge.challenged_indices.length} Blocks
            </span>
          )}
        </div>

        <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          {Array.from({ length: totalBlocks }).map((_, idx) => {
            const isChallenged = challengedSet.has(idx);
            const isVerifiedOk = verdict?.passed && isChallenged;
            const isFailed = verdict && !verdict.passed && isChallenged;

            return (
              <motion.div
                key={idx}
                animate={
                  isChallenged
                    ? { scale: [1, 1.15, 1], filter: 'drop-shadow(0 0 6px #06b6d4)' }
                    : { scale: 1 }
                }
                transition={{ duration: 1.5, repeat: isChallenged && !verdict ? Infinity : 0 }}
                className={`h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
                  isFailed
                    ? 'bg-rose-500 text-white shadow-[0_0_10px_#ef4444]'
                    : isVerifiedOk
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_#10b981]'
                    : isChallenged
                    ? 'bg-cyan-400 text-slate-950 animate-pulse'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'
                }`}
                title={`Block #${idx} (${isChallenged ? 'CHALLENGED' : 'IDLE'})`}
              >
                {idx}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Merkle Proof Audit Path Breadcrumbs */}
      {proof && proof.sampled_proofs.length > 0 && (
        <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-xs font-mono text-cyan-300 flex items-center justify-between mb-2">
            <span>Merkle Path Inclusion Trace: Block #{proof.sampled_proofs[0].index}</span>
            <span className="text-slate-500">Root: {proof.merkle_root.slice(0, 16)}...</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
            <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">
              Leaf_{proof.sampled_proofs[0].index}
            </span>
            {proof.sampled_proofs[0].merkle_proof.map((p, i) => (
              <React.Fragment key={i}>
                <span className="text-slate-600">→</span>
                <span className="px-2 py-1 rounded bg-cyan-950/50 border border-cyan-500/30 text-cyan-300">
                  {p.position.toUpperCase()} Sibling
                </span>
              </React.Fragment>
            ))}
            <span className="text-slate-600">→</span>
            <span className="px-2 py-1 rounded bg-indigo-950/70 border border-indigo-500/50 text-indigo-300 font-bold">
              Merkle Root
            </span>
          </div>
        </div>
      )}

      {/* Real-time Verdict Card */}
      <AnimatePresence>
        {verdict && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-5 p-4 rounded-xl border flex items-center justify-between ${
              verdict.passed
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {verdict.passed ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0" />
              )}
              <div>
                <div className="text-sm font-bold tracking-tight">
                  VERDICT: {verdict.status}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  {verdict.message} • Recorded in Simulated Ledger Seq #{verdict.ledger_seq}
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700">
                {verdict.verification_steps.filter((s) => s.passed).length} / {verdict.verification_steps.length} Passed
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
