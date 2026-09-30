import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, ShieldAlert, CheckCircle, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { CloudBackground } from '../components/CloudBackground';
import { api } from '../api/client';
import type { AlertRecord } from '../api/types';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleAck = async (id: number) => {
    try {
      await api.ackAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, acknowledged: 1 } : a))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-white tracking-tight">
                Security Alerts & Threat Center
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time anomaly detection, disk corruption alerts, and ledger integrity tracking
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadAlerts}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Severity Filter Chips */}
        <div className="flex items-center gap-2">
          {['all', 'critical', 'warning', 'info'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterSeverity(s)}
              className={`px-3 py-1 rounded-xl text-xs font-mono uppercase tracking-wider transition-all ${
                filterSeverity === s
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 font-mono text-xs">
              No security alerts currently recorded.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  alert.acknowledged
                    ? 'bg-slate-950/40 border-slate-800 opacity-60'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  {alert.severity === 'critical' ? (
                    <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  ) : alert.severity === 'warning' ? (
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {alert.kind}
                      </span>
                      {alert.file_ref && (
                        <span className="text-[11px] font-mono text-slate-400">
                          Ref: {alert.file_ref}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
                    <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                      {alert.created_at}
                    </span>
                  </div>
                </div>

                <div>
                  {alert.acknowledged ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Acknowledged</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAck(alert.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 transition-all"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </CloudBackground>
  );
};
