import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  FileText
} from 'lucide-react';
import { fetchAudits } from '../api/client';
import type { AuditHistoryRecord } from '../api/types';
import { formatDateTime, getStatusTheme, shortHash } from '../utils/formatters';
import { CloudBackground } from '../components/CloudBackground';

export const AuditsPage: React.FC = () => {
  const [audits, setAudits] = useState<AuditHistoryRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedAudit, setSelectedAudit] = useState<AuditHistoryRecord | null>(null);

  const loadAudits = async () => {
    try {
      setLoading(true);
      const data = await fetchAudits({ status: statusFilter || undefined });
      setAudits(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudits();
  }, [statusFilter]);

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-cyan-400" />
            Forensic Audit History & Verification Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Every audit verification creates an immutable forensic record in SQLite containing stopwatch step times and hash comparisons.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-[#07111F] p-1 border border-slate-800 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-500 ml-2" />
            <button
              onClick={() => setStatusFilter('')}
              className={`rounded-md px-2.5 py-1 transition-all ${
                statusFilter === '' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Logs
            </button>
            <button
              onClick={() => setStatusFilter('PASS')}
              className={`rounded-md px-2.5 py-1 transition-all ${
                statusFilter === 'PASS' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pass
            </button>
            <button
              onClick={() => setStatusFilter('TAMPERED')}
              className={`rounded-md px-2.5 py-1 transition-all ${
                statusFilter === 'TAMPERED' ? 'bg-red-500/20 text-red-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tampered
            </button>
            <button
              onClick={() => setStatusFilter('VERSION_HISTORY_ALTERED')}
              className={`rounded-md px-2.5 py-1 transition-all ${
                statusFilter === 'VERSION_HISTORY_ALTERED' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Chain Altered
            </button>
          </div>

          <button
            onClick={loadAudits}
            className="flex items-center gap-1 rounded-lg bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border-cyan-500/20">
        {loading ? (
          <div className="py-16 text-center text-slate-400 font-mono text-xs">
            Querying audit log ledger...
          </div>
        ) : audits.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No audit records matching criteria. Run an audit on a file to create logs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Audit ID</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">File Name & UUID</th>
                  <th className="py-3 px-3">Kind</th>
                  <th className="py-3 px-3">Verification Result</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {audits.map((a) => {
                  const theme = getStatusTheme(a.status);
                  return (
                    <tr key={a.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400">
                        #{a.id}
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-[11px]">
                        {formatDateTime(a.created_at)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-sans font-medium text-white">
                          {a.display_name || 'Unnamed Document'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {shortHash(a.file_id, 6)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          {a.kind}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] border ${theme.bg} ${theme.text} ${theme.border} ${theme.glow}`}>
                          {a.status === 'PASS' && <CheckCircle2 className="h-3 w-3" />}
                          {a.status === 'TAMPERED' && <XCircle className="h-3 w-3" />}
                          {a.status === 'VERSION_HISTORY_ALTERED' && <AlertTriangle className="h-3 w-3" />}
                          <span>{theme.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedAudit(a)}
                          className="rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-2.5 py-1 text-[11px] transition-all"
                        >
                          View Trace
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl p-6 border-cyan-500/40 shadow-[0_0_35px_rgba(34,211,238,0.2)] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-white">
                  Audit Execution Record #{selectedAudit.id}
                </h3>
                <p className="text-xs text-slate-400">
                  Logged on {formatDateTime(selectedAudit.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedAudit(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-[#07111F] p-3.5 border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">File ID:</span>
                  <span className="text-slate-200 select-all">{selectedAudit.file_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kind:</span>
                  <span className="text-cyan-300 font-semibold">{selectedAudit.kind}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Final Verdict:</span>
                  <span className="text-white font-bold">{selectedAudit.status}</span>
                </div>
              </div>

              {selectedAudit.details?.steps && (
                <div>
                  <div className="text-[11px] font-mono uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Stopwatch Timing Trace</span>
                  </div>
                  <div className="space-y-1.5 font-mono">
                    {selectedAudit.details.steps.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-[#07111F] px-3 py-2 border border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          {s.ok ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                          )}
                          <span className="text-slate-300">{s.name}</span>
                        </div>
                        <span className="text-cyan-400">{s.ms} ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-mono uppercase text-slate-400 mb-1">
                  Raw Details JSON:
                </div>
                <pre className="rounded-xl bg-slate-950 p-3 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAudit.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setSelectedAudit(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-1.5 text-xs text-white"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </CloudBackground>
  );
};
