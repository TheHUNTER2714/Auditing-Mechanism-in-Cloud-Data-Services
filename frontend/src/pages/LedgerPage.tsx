import React from 'react';
import { CloudBackground } from '../components/CloudBackground';
import { LedgerViewer } from '../components/LedgerViewer';
import { Database, ShieldCheck, Cpu, Key } from 'lucide-react';

export const LedgerPage: React.FC = () => {
  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Database className="h-4 w-4" />
            <span>Cryptographic Proof Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
            Simulated Local Append-Only Ledger (Simulated Blockchain)
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            Every audit verdict, public challenge seed, deduplication registration, and security alert
            is permanently appended to this hash-chained ledger. The entire sequence is verifiable
            in real-time via <code className="text-cyan-300">GET /api/ledger/verify</code>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">HASH FORMULA</div>
              <div className="text-xs font-mono text-cyan-300 mt-0.5 truncate">
                SHA256(prev_hash || type || payload || time)
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">PUBLIC SEED EPOCH</div>
              <div className="text-xs font-mono text-indigo-300 mt-0.5">
                300s (5-Minute Time Buckets)
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">LEDGER IMMUTABILITY</div>
              <div className="text-xs font-mono text-emerald-300 mt-0.5">
                Strict Sequential Verification
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Explorer */}
        <LedgerViewer />
      </div>
    </CloudBackground>
  );
};
