import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Users, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Sliders, 
  Lock,
  UserCheck,
  UserX,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';
import { formatDateTime } from '../utils/formatters';

export const AdminPage: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [logVerify, setLogVerify] = useState<{ valid: boolean; bad_entry?: number; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingLog, setVerifyingLog] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [ov, usrs, evts, pol] = await Promise.all([
        api.getAdminOverview().catch(() => null),
        api.getAdminUsers().catch(() => []),
        api.getAdminSecurityEvents().catch(() => []),
        api.getAdminPolicy().catch(() => null),
      ]);
      setOverview(ov);
      setUsers(usrs);
      setEvents(evts);
      setPolicy(pol);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleUserAction = async (userId: string, action: 'approve' | 'reject' | 'suspend' | 'reactivate') => {
    try {
      setActionMsg(`Applying action: ${action} on user ${userId}...`);
      await api.adminUserAction(userId, action);
      setActionMsg(`User status updated successfully!`);
      setTimeout(() => setActionMsg(null), 4000);
      await loadAdminData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleVerifyAuditLog = async () => {
    try {
      setVerifyingLog(true);
      const res = await api.verifyAdminLog();
      setLogVerify(res);
    } catch (err: any) {
      alert(`Audit log verification failed: ${err.message}`);
    } finally {
      setVerifyingLog(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-mono text-slate-400">
        Loading internal system administration telemetry...
      </div>
    );
  }

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header & Isolation Notice */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-amber-500/30 backdrop-blur-xl">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono mb-2">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Break-Glass Human Administration Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
              Internal System Administration & Policy Control
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Routine administrative tasks (suspicious-activity bans, auto-approvals, watchdog alerts) are automated by the Policy Engine.
              This interface is reserved for break-glass overrides. Administrators have ZERO permission to view or download Owner file contents.
            </p>
          </div>

          <button
            onClick={loadAdminData}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 self-start md:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {actionMsg && (
          <div className="p-4 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-xs font-mono text-cyan-300">
            {actionMsg}
          </div>
        )}

        {/* Telemetry Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-[11px] font-mono text-slate-500 block uppercase">Total Accounts</span>
            <span className="text-2xl font-bold font-serif text-white">{overview?.users_count ?? users.length}</span>
          </div>
          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-[11px] font-mono text-slate-500 block uppercase">Active Files</span>
            <span className="text-2xl font-bold font-serif text-cyan-400">{overview?.active_files ?? 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-[11px] font-mono text-slate-500 block uppercase">Quarantined Files</span>
            <span className="text-2xl font-bold font-serif text-amber-400">{overview?.quarantined_files ?? 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-[11px] font-mono text-slate-500 block uppercase">Pending Registrations</span>
            <span className="text-2xl font-bold font-serif text-purple-400">
              {users.filter(u => u.status === 'PENDING').length}
            </span>
          </div>
        </div>

        {/* Cryptographic Audit Log Verification Card */}
        <div className="glass-panel p-6 rounded-2xl border-cyan-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
                Tamper-Evident Audit Log Cryptographic Integrity
              </h2>
              <p className="text-xs text-slate-400">
                Verifies HMAC-SHA256 hash chaining of all recorded security events and admin activities using LOG_SECRET.
              </p>
            </div>

            <button
              onClick={handleVerifyAuditLog}
              disabled={verifyingLog}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${verifyingLog ? 'animate-spin' : ''}`} />
              <span>{verifyingLog ? 'Verifying Chain...' : 'Verify Audit Log HMAC Chain'}</span>
            </button>
          </div>

          {logVerify && (
            <div className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between ${
              logVerify.valid
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                : 'bg-red-950/40 text-red-300 border-red-500/40'
            }`}>
              <div className="flex items-center gap-2">
                {logVerify.valid ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <span>
                  {logVerify.valid
                    ? 'Audit Log Integrity Verified: All sequence links and HMAC signatures are valid.'
                    : `INTEGRITY COMPROMISED at Entry #${logVerify.bad_entry}: ${logVerify.reason}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User Account Management Table */}
        <div className="glass-panel rounded-2xl border-slate-800 overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-400" />
              User Accounts & Status Controls
            </h2>
            <span className="text-xs font-mono text-slate-400">{users.length} accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Email Verified</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3">
                      <div className="text-white font-medium">{u.name || 'Anonymous User'}</div>
                      <div className="text-[10px] text-slate-500">{u.email || u.username}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        u.role === 'ADMIN' ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                          : u.status === 'SUSPENDED'
                          ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {u.email_verified ? 'Yes' : 'No'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[10px]">
                      {u.created_at ? formatDateTime(u.created_at) : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      {u.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleUserAction(u.id, 'approve')}
                            className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 text-[10px]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUserAction(u.id, 'reject')}
                            className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-[10px]"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {u.status === 'ACTIVE' && u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleUserAction(u.id, 'suspend')}
                          className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-[10px]"
                        >
                          Suspend
                        </button>
                      )}
                      {u.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleUserAction(u.id, 'reactivate')}
                          className="px-2 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 text-[10px]"
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Events & Policy Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security Events */}
          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Recent Security & Activity Events
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-[11px]">
              {events.length === 0 ? (
                <div className="text-slate-500 py-6 text-center">No recent security events logged.</div>
              ) : (
                events.map((evt) => (
                  <div key={evt.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-white font-semibold mr-2">{evt.action}</span>
                      <span className="text-slate-400 text-[10px]">({evt.target})</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                      evt.result === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {evt.result}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Policy Config */}
          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-purple-400" />
              Automated Policy Engine Configuration (policy.yaml)
            </h3>
            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
              {JSON.stringify(policy || {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </CloudBackground>
  );
};

export default AdminPage;
