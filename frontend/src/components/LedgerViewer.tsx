import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Link2, Unlink, RefreshCw, Database } from 'lucide-react';
import { api } from '../api/client';
import type { LedgerEntry, LedgerVerifyResult } from '../api/types';

export const LedgerViewer: React.FC = () => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [verifyResult, setVerifyResult] = useState<LedgerVerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tampering, setTampering] = useState(false);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const data = await api.getLedger(1, 100);
      setEntries(data);
      const v = await api.verifyLedger();
      setVerifyResult(v);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleTamperSimulation = async () => {
    setTampering(true);
    try {
      await api.tamperLedger();
      await fetchLedger();
    } catch (e) {
      console.error(e);
    } finally {
      setTampering(false);
    }
  };

  const getEntryBadgeColor = (type: string) => {
    switch (type) {
      case 'GENESIS':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'AUDIT_RESULT':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'CHALLENGE_SEED':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'DEDUP_REGISTER':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'ALERT':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-cyan-500/25 p-5 sm:p-6 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Simulated Local Append-Only Ledger (Simulated Blockchain)
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Cryptographic hash chaining: entry_hash = SHA256(prev_hash || entry_type || payload || created_at)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLedger}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Verify Chain</span>
          </button>

          <button
            type="button"
            onClick={handleTamperSimulation}
            disabled={tampering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 text-xs font-mono transition-all"
            title="Simulate attacker mutating an immutable ledger row"
          >
            <Unlink className="h-3.5 w-3.5 text-rose-400" />
            <span>[Demo Tamper Ledger]</span>
          </button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {verifyResult && (
        <div
          className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
            verifyResult.chain_valid
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/50 text-rose-300 animate-pulse'
          }`}
        >
          <div className="flex items-center gap-2">
            {verifyResult.chain_valid ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            )}
            <span>
              STATUS: <strong>{verifyResult.status}</strong> •{' '}
              {verifyResult.chain_valid
                ? 'All block hashes strictly continuous and verified'
                : `BROKEN LINK at Sequence #${verifyResult.first_bad_seq}: ${verifyResult.error_message}`}
            </span>
          </div>
          <span>Total Entries: {entries.length}</span>
        </div>
      )}

      {/* Blockchain Entries List */}
      <div className="mt-5 space-y-3">
        {entries.map((entry, index) => {
          const isBroken =
            verifyResult && !verifyResult.chain_valid && verifyResult.first_bad_seq === entry.seq;

          return (
            <motion.div
              key={entry.seq}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border transition-all ${
                isBroken
                  ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                    #{entry.seq}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getEntryBadgeColor(
                      entry.entry_type
                    )}`}
                  >
                    {entry.entry_type}
                  </span>
                  <span className="text-slate-400 text-[11px]">{entry.created_at}</span>
                </div>

                <div className="text-[10px] text-slate-500 truncate max-w-xs">
                  {JSON.stringify(entry.payload)}
                </div>
              </div>

              {/* Cryptographic Linkage Hash Display */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="truncate text-slate-400">
                  <span className="text-slate-600">prev_hash:</span> {entry.prev_hash}
                </div>
                <div className="truncate text-cyan-400 flex items-center justify-between">
                  <div>
                    <span className="text-slate-600">entry_hash:</span> {entry.entry_hash}
                  </div>
                  {index < entries.length - 1 && (
                    <span className="text-slate-600 ml-2">
                      {isBroken ? (
                        <Unlink className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Link2 className="h-3 w-3 text-cyan-500" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
