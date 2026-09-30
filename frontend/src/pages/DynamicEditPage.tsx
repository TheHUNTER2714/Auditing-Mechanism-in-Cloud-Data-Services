import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Edit3, Plus, Trash2, ArrowLeft, ShieldCheck, RefreshCw, GitCommit } from 'lucide-react';
import { CloudBackground } from '../components/CloudBackground';
import { api } from '../api/client';
import type { FileRecord, VersionRecord } from '../api/types';

export const DynamicEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<FileRecord | null>(null);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [operation, setOperation] = useState<'modify' | 'insert' | 'append' | 'delete'>('modify');
  const [targetIndex, setTargetIndex] = useState<number>(0);
  const [blockText, setBlockText] = useState<string>('Updated dynamic content block payload');
  const [loading, setLoading] = useState(false);
  const [lastDiffResult, setLastDiffResult] = useState<any>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      const vData = await api.getFileVersions(id);
      setVersions(vData.versions);
      const files = await api.listFiles();
      const f = files.find((x) => x.id === id);
      if (f) setFile(f);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.dynamicBlockOperation(id, operation, targetIndex, blockText);
      setLastDiffResult(res);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          to="/files"
          className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Files Inventory</span>
        </Link>

        {/* Header */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Edit3 className="h-4 w-4" />
            <span>O(log n) Path Traversal Engine</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-white tracking-tight">
            Dynamic Block-Level Operations & Merkle Diff
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Target File: <span className="text-white font-bold">{file?.display_name}</span> • Current Head: V{file?.current_version}
          </p>
        </div>

        {/* Dynamic Op Editor Form */}
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5 shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['modify', 'insert', 'append', 'delete'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setOperation(op)}
                className={`p-3 rounded-xl border text-xs font-mono uppercase font-bold tracking-wider transition-all ${
                  operation === op
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {op}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {operation !== 'append' && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Target Block Index</label>
                <input
                  type="number"
                  min="0"
                  value={targetIndex}
                  onChange={(e) => setTargetIndex(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            {operation !== 'delete' && (
              <div className={operation === 'append' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-mono text-slate-400 mb-1">New Block Payload Content</label>
                <input
                  type="text"
                  value={blockText}
                  onChange={(e) => setBlockText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.35)] disabled:opacity-50"
          >
            {loading ? 'Rebuilding Affected Merkle Path...' : `Commit Dynamic ${operation.toUpperCase()} (Creates V${(file?.current_version || 1) + 1})`}
          </button>
        </form>

        {/* Merkle Diff Result Card */}
        {lastDiffResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 text-xs font-mono space-y-2"
          >
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <GitCommit className="h-4 w-4" />
              <span>DYNAMIC OPERATION COMMITTED: V{lastDiffResult.version}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 pt-2">
              <div>Operation: <strong>{lastDiffResult.operation}</strong> at index #{lastDiffResult.target_index}</div>
              <div>Block Count: <strong>{lastDiffResult.block_count}</strong></div>
              <div className="truncate">New Merkle Root: {lastDiffResult.merkle_root}</div>
              <div className="truncate">New Chain Hash: {lastDiffResult.chain_hash}</div>
            </div>
          </motion.div>
        )}
      </div>
    </CloudBackground>
  );
};
