import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Files, 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  UploadCloud, 
  RefreshCw, 
  Database,
  ArrowRight,
  Sparkles,
  Server
} from 'lucide-react';
import { fetchStats, demoReset, demoSeed, fetchConfig } from '../api/client';
import type { StatsResponse, ConfigResponse } from '../api/types';
import { CloudBackground } from '../components/CloudBackground';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, c] = await Promise.all([fetchStats(), fetchConfig()]);
      setStats(s);
      setConfig(c);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeed = async () => {
    try {
      setActionMsg('Seeding prototype demo files...');
      await demoSeed();
      await loadData();
      setActionMsg('Prototype Demo Data loaded successfully!');
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      setActionMsg(`Failed to seed: ${err.message}`);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset simulated storage and database to pristine state?')) return;
    try {
      setActionMsg('Resetting simulated storage and database...');
      await demoReset();
      await loadData();
      setActionMsg('Reset completed successfully.');
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      setActionMsg(`Failed to reset: ${err.message}`);
    }
  };

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Top Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Audit Operations Dashboard
              </h1>
            {stats?.is_demo_seeded && (
              <span className="rounded-full bg-cyan-500/15 border border-cyan-400/40 px-2.5 py-0.5 text-xs font-mono font-medium text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                Prototype Demo Data
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time verification telemetry computed directly from SQLite database and simulated cloud storage.
          </p>
        </div>

        {/* Demo Controls */}
        <div className="flex items-center gap-2">
          {config?.demo_mode ? (
            <>
              <button
                onClick={handleSeed}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/40 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 transition-all shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                title="Loads clean, verified demo files with history"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Load Prototype Demo Data</span>
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-red-950/40 hover:text-red-300 hover:border-red-500/40 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reset Storage & DB</span>
              </button>
            </>
          ) : (
            <div className="text-[11px] font-mono text-slate-500 rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2">
              DEMO ATTACKER MODE: OFF
            </div>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="mb-6 rounded-lg bg-cyan-950/40 border border-cyan-500/40 p-3 text-xs font-mono text-cyan-300 animate-fadeIn">
          {actionMsg}
        </div>
      )}

      {/* Primary Telemetry Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Stored Files */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Stored Files</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Files className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-white mb-1">
            {loading ? '...' : stats?.total_files ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>In simulated storage</span>
            <Link to="/files" className="text-cyan-400 hover:underline flex items-center gap-1">
              View <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Total Versions Recorded */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Version Chain Blocks</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-white mb-1">
            {loading ? '...' : stats?.total_versions ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>HMAC-chained revisions</span>
            <span className="font-mono text-blue-400">SHA-256 + Secret</span>
          </div>
        </div>

        {/* Audits Executed */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Audits Performed</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-white mb-1">
            {loading ? '...' : stats?.audits_performed ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Forensic ledger logs</span>
            <Link to="/audits" className="text-emerald-400 hover:underline flex items-center gap-1">
              Log <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Tamper Detections */}
        <div className="glass-panel rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Tamper Events Caught</span>
            <div className={`p-2 rounded-lg border ${
              (stats?.tamper_events ?? 0) > 0 
                ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-3xl font-serif font-bold mb-1 ${
            (stats?.tamper_events ?? 0) > 0 ? 'text-red-400' : 'text-white'
          }`}>
            {loading ? '...' : stats?.tamper_events ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Disk corruption or DB edits</span>
            <span className={`font-mono text-[10px] ${
              (stats?.tamper_events ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {(stats?.tamper_events ?? 0) > 0 ? 'TAMPER CAUGHT' : 'CLEAN'}
            </span>
          </div>
        </div>
      </div>

      {/* Architecture & Workflow Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Model Summary */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-6">
          <h2 className="text-lg font-serif font-semibold text-white mb-2 flex items-center gap-2">
            <Server className="h-5 w-5 text-cyan-400" />
            Version-Based Dynamic Cloud Data Auditing Architecture
          </h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            This prototype addresses data integrity and version control in cloud data services through an unforgeable cryptographic version chain:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-6">
            <div className="rounded-lg bg-[#07111F] p-3 border border-slate-800">
              <div className="font-mono text-cyan-400 font-semibold mb-1">1. Active Payload Verification</div>
              <div className="text-slate-300">
                Audits current storage payload by streaming SHA-256 in 1 MB chunks and comparing against recorded head hash.
              </div>
            </div>
            <div className="rounded-lg bg-[#07111F] p-3 border border-slate-800">
              <div className="font-mono text-cyan-400 font-semibold mb-1">2. Secret-Anchored Chain (HMAC)</div>
              <div className="text-slate-300">
                Version blocks are signed using an unexposed server key. Recalculation by unauthorized database editors fails verification.
              </div>
            </div>
            <div className="rounded-lg bg-[#07111F] p-3 border border-slate-800">
              <div className="font-mono text-cyan-400 font-semibold mb-1">3. Historical Blob Continuity</div>
              <div className="text-slate-300">
                Retains immutable byte archives for every previous version to verify retroactive file altering.
              </div>
            </div>
            <div className="rounded-lg bg-[#07111F] p-3 border border-slate-800">
              <div className="font-mono text-cyan-400 font-semibold mb-1">4. Owner-Held Receipts</div>
              <div className="text-slate-300">
                Client receipts cached in <code className="text-cyan-300">localStorage</code> prevent server rollback attacks to older states.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/upload"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.25)]"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload New File to Cloud Storage</span>
            </Link>
            <Link
              to="/files"
              className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 px-4 py-2 text-xs font-semibold text-white border border-slate-700 transition-all"
            >
              <Files className="h-4 w-4 text-cyan-400" />
              <span>Manage Files & Run Audits</span>
            </Link>
          </div>
        </div>

        {/* Quick Auditing Guide / System Parameters */}
        <div className="glass-panel rounded-xl p-6">
          <h2 className="text-lg font-serif font-semibold text-white mb-2 flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-400" />
            Runtime Environment
          </h2>
          <div className="space-y-3 text-xs mb-4">
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Storage Layer:</span>
              <span className="font-mono text-cyan-300">Simulated Cloud Storage</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Database Engine:</span>
              <span className="font-mono text-slate-200">SQLite 3 (Row Factory)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Hash Algorithm:</span>
              <span className="font-mono text-slate-200">SHA-256 (1MB Stream)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Chain Mechanism:</span>
              <span className="font-mono text-slate-200">HMAC-SHA256 (Keyed)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Max Upload Limit:</span>
              <span className="font-mono text-slate-200">{config?.max_upload_mb ?? 25} MB</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Demo Attacker Mode:</span>
              <span className={`font-mono font-semibold ${
                config?.demo_mode ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {config?.demo_mode ? 'ENABLED (Testing)' : 'DISABLED'}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-blue-950/20 border border-blue-500/20 p-3 text-[11px] text-slate-400">
            <span className="text-cyan-400 font-medium font-mono">Academic Note:</span> Demonstrates dynamic data auditing without requiring third-party cloud billing or complex blockchain transaction delays.
          </div>
        </div>
      </div>
      </div>
    </CloudBackground>
  );
};
