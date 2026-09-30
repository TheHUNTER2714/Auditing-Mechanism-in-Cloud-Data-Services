import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { EyeOff, ShieldCheck, Lock, Activity } from 'lucide-react';
import { CloudBackground } from '../components/CloudBackground';
import { SpotCheckVisualizer } from '../components/SpotCheckVisualizer';
import { api } from '../api/client';
import type { FileRecord } from '../api/types';

export const TPAConsolePage: React.FC = () => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');

  const loadFiles = async () => {
    try {
      const data = await api.listFiles();
      setFiles(data);
      if (data.length > 0 && !selectedFileId) {
        setSelectedFileId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Title & Trust Model Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono mb-2">
              <EyeOff className="h-3.5 w-3.5" />
              <span>Zero-Knowledge Ownership Privacy Protected</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
              Third-Party Auditor (TPA) Verification Console
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              The TPA audits data integrity without obtaining plaintext file names or raw bytes.
              Challenges are derived from unmanipulable public randomness seeds (`SHA256(ledger_head || epoch)`),
              preventing auditor laziness or cherry-picking attacks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-right font-mono">
              <div className="text-[10px] text-slate-500">TPA PERMISSIONS</div>
              <div className="text-xs text-amber-300 font-bold">BLINDED ACCESS ONLY</div>
            </div>
          </div>
        </div>

        {/* File Selector */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="file-select" className="text-xs font-mono text-slate-400">Target File Tag:</label>
            <select
              id="file-select"
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="bg-slate-950 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
            >
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.display_name} (V{f.current_version}) • {f.id.slice(0, 8)}...
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono text-slate-500">
            Plaintext file download: <span className="text-rose-400 font-bold">BLOCKED (403)</span>
          </div>
        </div>

        {/* Spot-Check Visualizer */}
        <SpotCheckVisualizer fileId={selectedFileId} onAuditFinished={loadFiles} />
      </div>
    </CloudBackground>
  );
};
