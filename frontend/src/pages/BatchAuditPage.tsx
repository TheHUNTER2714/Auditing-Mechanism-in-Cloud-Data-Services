import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { CloudBackground } from '../components/CloudBackground';
import { api } from '../api/client';
import type { BatchAuditResult, FileRecord } from '../api/types';

export const BatchAuditPage: React.FC = () => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchAuditResult | null>(null);

  const loadFiles = async () => {
    try {
      const data = await api.listFiles();
      setFiles(data);
      // Select all by default
      setSelectedIds(data.map((f) => f.id));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleRunBatch = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setBatchResult(null);

    try {
      const res = await api.batchAudit(selectedIds);
      setBatchResult(res);
      await loadFiles();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-white tracking-tight">
                Batch Integrity Auditing Engine
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Audit multiple cloud datasets concurrently with aggregate simulated blockchain ledger receipts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunBatch}
            disabled={loading || selectedIds.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Auditing Batch...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Execute Batch Audit ({selectedIds.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Aggregate Verdict Summary Card */}
        {batchResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border ${
              batchResult.status === 'PASS'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {batchResult.status === 'PASS' ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-7 w-7 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="text-base font-bold tracking-tight">
                    BATCH RESULT: {batchResult.status}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {batchResult.passed_files} Passed • {batchResult.failed_files} Failed • Recorded in Ledger Seq #{batchResult.batch_seq}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700">
                  Total Checked: {batchResult.total_files}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Files Selection Table */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Select files to include in batch challenge</span>
            <span>{selectedIds.length} of {files.length} selected</span>
          </div>

          <div className="divide-y divide-slate-850">
            {files.map((file) => {
              const isSelected = selectedIds.includes(file.id);
              const fileResult = batchResult?.results.find((r) => r.file_id === file.id);

              return (
                <div
                  key={file.id}
                  onClick={() => toggleSelect(file.id)}
                  className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-all ${
                    isSelected ? 'bg-cyan-500/5 hover:bg-cyan-500/10' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-400"
                    />
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {file.display_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        ID: {file.id.slice(0, 8)}... • V{file.current_version} • Hash: {file.content_hash.slice(0, 16)}...
                      </div>
                    </div>
                  </div>

                  {fileResult && (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                        fileResult.passed
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {fileResult.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </CloudBackground>
  );
};
