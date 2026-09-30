import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Files, 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  RefreshCw, 
  Sparkles,
  Server,
  Activity,
  Database
} from 'lucide-react';
import { fetchStats, fetchConfig, fetchAudits, api } from '../api/client';
import type { StatsResponse, ConfigResponse, AuditHistoryRecord } from '../api/types';
import { CloudBackground } from '../components/CloudBackground';
import { formatDateTime, shortHash, getStatusTheme } from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [recentAudits, setRecentAudits] = useState<AuditHistoryRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [s, c, a] = await Promise.all([
        fetchStats(),
        fetchConfig(),
        fetchAudits()
      ]);
      setStats(s);
      setConfig(c);
      setRecentAudits(a.slice(0, 5));

      // Attempt to load recent events
      try {
        const events = await api.getEvents();
        setRecentEvents(events.slice(0, 6));
      } catch {
        setRecentEvents([]);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleSeed = async () => {
    try {
      setActionMsg('Seeding demo files & initial history...');
      await api.seedDemo();
      await loadDashboardData();
      setActionMsg('Demo files and version history seeded successfully!');
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      setActionMsg(`Failed to seed: ${err.message}`);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset simulated storage and database to clean state?')) return;
    try {
      setActionMsg('Resetting simulated storage and database...');
      await api.resetDemo();
      await loadDashboardData();
      setActionMsg('Reset completed successfully.');
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      setActionMsg(`Failed to reset: ${err.message}`);
    }
  };

  // Derive verdict breakdown from audits
  const passCount = recentAudits.filter(a => a.status === 'PASS').length;
  const tamperedCount = recentAudits.filter(a => a.status === 'TAMPERED').length;
  const alteredCount = recentAudits.filter(a => a.status === 'VERSION_HISTORY_ALTERED').length;

  return (
    <CloudBackground className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header & Fast Demo Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Operations & Integrity Telemetry
              </h1>
              {stats?.is_demo_seeded && (
                <span className="rounded-full bg-cyan-500/15 border border-cyan-400/40 px-2.5 py-0.5 text-xs font-mono font-medium text-cyan-300">
                  Demo Seeded
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Summarized verification metrics computed from simulated storage, SQLite hash chains, and the public audit ledger.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboardData}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {config?.demo_mode && (
              <>
                <button
                  onClick={handleSeed}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/40 px-3 py-2 text-xs font-mono font-medium text-cyan-300 hover:bg-cyan-500/25 transition-all shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Seed Demo Data</span>
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs font-mono text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reset DB</span>
                </button>
              </>
            )}
          </div>
        </div>

        {actionMsg && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
            {actionMsg}
          </div>
        )}

        {/* 1. Primary Metrics Grid (Total Files, Total Versions, Total Audits, Tamper Events) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel rounded-2xl p-5 border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Total Files</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Files className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-serif font-bold text-white mb-1">
              {loading ? '...' : stats?.total_files ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Simulated cloud storage</span>
              <Link to="/files" className="text-cyan-400 hover:underline flex items-center gap-1 font-mono">
                Inventory <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Total Versions</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-serif font-bold text-white mb-1">
              {loading ? '...' : stats?.total_versions ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Chained revisions</span>
              <span className="font-mono text-blue-400">HMAC-SHA256</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Total Audits</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-serif font-bold text-white mb-1">
              {loading ? '...' : stats?.audits_performed ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Full trials recorded</span>
              <Link to="/audits" className="text-emerald-400 hover:underline flex items-center gap-1 font-mono">
                Log <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Tamper Events</span>
              <div className={`p-2 rounded-xl border ${
                (stats?.tamper_events ?? 0) > 0
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
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
              <span>Caught by precedence check</span>
              <Link to="/alerts" className="text-red-400 hover:underline flex items-center gap-1 font-mono">
                Alerts <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Verdict Breakdown & Status Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-5 rounded-2xl border-emerald-500/30 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-emerald-400 font-semibold">PASS VERDICTS</span>
              <div className="text-2xl font-serif font-bold text-white">
                {recentAudits.length > 0 ? passCount : '0'}
              </div>
              <p className="text-[11px] text-slate-400">Chain & disk payload matching baseline</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
          </div>

          <div className="glass-panel p-5 rounded-2xl border-red-500/30 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-red-400 font-semibold">TAMPERED (DISK)</span>
              <div className="text-2xl font-serif font-bold text-white">
                {recentAudits.length > 0 ? tamperedCount : '0'}
              </div>
              <p className="text-[11px] text-slate-400">Physical file bytes altered on storage</p>
            </div>
            <XCircle className="h-8 w-8 text-red-400/50" />
          </div>

          <div className="glass-panel p-5 rounded-2xl border-amber-500/30 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-amber-400 font-semibold">VERSION_HISTORY_ALTERED</span>
              <div className="text-2xl font-serif font-bold text-white">
                {recentAudits.length > 0 ? alteredCount : '0'}
              </div>
              <p className="text-[11px] text-slate-400">HMAC chain broken in database</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-400/50" />
          </div>
        </div>

        {/* 3. System Integrity & Version Chain Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
            <h3 className="font-serif text-base font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Cryptographic Integrity Status
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Storage Layer:</span>
                <span className="text-emerald-400 font-semibold">Simulated Cloud Storage (Online)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Version Chain Mechanism:</span>
                <span className="text-cyan-300">HMAC-SHA256 (Keyed Anchor)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Anti-Forgery Block Tags:</span>
                <span className="text-indigo-300">Wang et al. 2024 (64 KB Blocks)</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Public Audit Ledger:</span>
                <span className="text-emerald-400 font-semibold">Append-Only Sequence Active</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
            <h3 className="font-serif text-base font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-400" />
              Quick Application Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <Link
                to="/upload"
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400/40 text-slate-300 hover:text-white transition-all flex flex-col justify-between"
              >
                <span className="text-cyan-400 font-semibold">Upload Payload</span>
                <span className="text-[10px] text-slate-400">Ingest new file & anchor</span>
              </Link>
              <Link
                to="/files"
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-400/40 text-slate-300 hover:text-white transition-all flex flex-col justify-between"
              >
                <span className="text-blue-400 font-semibold">Files Inventory</span>
                <span className="text-[10px] text-slate-400">Manage versions & edit</span>
              </Link>
              <Link
                to="/tpa"
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-400/40 text-slate-300 hover:text-white transition-all flex flex-col justify-between"
              >
                <span className="text-indigo-400 font-semibold">TPA Console</span>
                <span className="text-[10px] text-slate-400">Spot-check verification</span>
              </Link>
              <Link
                to="/benchmarks"
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-400/40 text-slate-300 hover:text-white transition-all flex flex-col justify-between"
              >
                <span className="text-emerald-400 font-semibold">Benchmarks</span>
                <span className="text-[10px] text-slate-400">Latency & detection curves</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4. Recent Audits & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Audits Table (7 cols) */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Recent Audits
              </h3>
              <Link to="/audits" className="text-xs font-mono text-cyan-400 hover:underline">
                View All ({recentAudits.length}) →
              </Link>
            </div>

            {recentAudits.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No audit trials recorded yet. Seed demo data or run an audit from Files Inventory.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <th className="pb-2 font-normal">File / Target</th>
                      <th className="pb-2 font-normal">Version</th>
                      <th className="pb-2 font-normal">Verdict</th>
                      <th className="pb-2 font-normal">Latency</th>
                      <th className="pb-2 font-normal text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentAudits.map((a) => {
                      const theme = getStatusTheme(a.status);
                      return (
                        <tr key={a.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2.5 text-white truncate max-w-[140px]">
                            {a.file_id ? shortHash(a.file_id, 8) : 'All Files'}
                          </td>
                          <td className="py-2.5 text-slate-400">
                            V{a.details?.checked_version ?? a.details?.current_version ?? 1}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${theme.bg} ${theme.text} ${theme.border}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-cyan-300">
                            {a.details?.execution_time_ms ? `${Number(a.details.execution_time_ms).toFixed(1)}ms` : (a.details?.total_ms ? `${Number(a.details.total_ms).toFixed(1)}ms` : '—')}
                          </td>
                          <td className="py-2.5 text-slate-500 text-right text-[11px]">
                            {formatDateTime(a.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Activity Feed (5 cols) */}
          <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
            <h3 className="font-serif text-base font-semibold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Recent System Activity
            </h3>

            {recentEvents.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No recent activity events logged.
              </div>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {recentEvents.map((ev, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#030611] border border-slate-800 flex items-start justify-between gap-2">
                    <div>
                      <span className="text-cyan-400 font-semibold block text-[11px] uppercase">
                        {ev.event_type}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {ev.details?.message || ev.details?.file_id ? shortHash(ev.details.file_id, 8) : 'System operation executed'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formatDateTime(ev.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </CloudBackground>
  );
};

export default DashboardPage;
