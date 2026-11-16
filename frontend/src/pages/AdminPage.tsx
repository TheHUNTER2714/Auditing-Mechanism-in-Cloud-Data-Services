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
  FileText,
  Clock,
  Play,
  FileCode,
  ShieldAlert as ShieldAlertIcon
} from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';
import { formatDateTime } from '../utils/formatters';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'audits' | 'security' | 'config'>('overview');
  const [regFilter, setRegFilter] = useState<'pending' | 'approved' | 'rejected' | 'suspended'>('pending');

  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [failedVerifs, setFailedVerifs] = useState<any[]>([]);
  const [auditOps, setAuditOps] = useState<any>({ audits: [], delegations: [], jobs: [] });
  const [scheduler, setScheduler] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [logVerify, setLogVerify] = useState<{ valid: boolean; bad_entry?: number; reason?: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [verifyingLog, setVerifyingLog] = useState(false);
  const [triggeringScheduler, setTriggeringScheduler] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [ov, usrs, evts, fv, aops, sched, pol, rep] = await Promise.all([
        api.getAdminOverview().catch(() => null),
        api.getAdminUsers().catch(() => []),
        api.getAdminSecurityEvents().catch(() => []),
        api.getAdminFailedVerifications().catch(() => []),
        api.getAdminAuditMonitoring().catch(() => ({ audits: [], delegations: [], jobs: [] })),
        api.getAdminScheduler().catch(() => null),
        api.getAdminPolicy().catch(() => null),
        api.getAdminReports().catch(() => null),
      ]);
      setOverview(ov);
      setUsers(usrs);
      setEvents(evts);
      setFailedVerifs(fv);
      setAuditOps(aops || { audits: [], delegations: [], jobs: [] });
      setScheduler(sched);
      setPolicy(pol);
      setReports(rep);
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
    let reason = '';
    if (action === 'reject') {
      const promptReason = window.prompt('Enter mandatory reason for rejection:');
      if (promptReason === null) return;
      if (!promptReason.trim()) {
        alert('Rejection requires a mandatory reason.');
        return;
      }
      reason = promptReason.trim();
    }

    try {
      setActionMsg(`Applying action: ${action.toUpperCase()} on user ${userId}...`);
      await api.adminUserAction(userId, action, reason);
      setActionMsg(`User status updated to ${action.toUpperCase()} successfully.`);
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

  const handleTriggerScheduler = async () => {
    try {
      setTriggeringScheduler(true);
      await api.triggerAdminScheduler();
      setActionMsg('Audit scheduler triggered successfully! Checking files...');
      setTimeout(() => setActionMsg(null), 4000);
      await loadAdminData();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    } finally {
      setTriggeringScheduler(false);
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'PENDING' || u.status === 'PENDING_APPROVAL' || u.status === 'EMAIL_VERIFICATION_PENDING');
  const approvedUsers = users.filter((u) => u.status === 'ACTIVE');
  const rejectedUsers = users.filter((u) => u.status === 'REJECTED');
  const suspendedUsers = users.filter((u) => u.status === 'SUSPENDED');

  const parseRisk = (verifJson?: string) => {
    if (!verifJson) return null;
    try {
      return JSON.parse(verifJson);
    } catch {
      return null;
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
    <CloudBackground className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Isolation Notice */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-amber-500/30 backdrop-blur-xl">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono mb-2">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Break-Glass Human Administration Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
              Administration & Policy Engine Control
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Routine management (suspicious bans, watchdog alerts) is automated by the Policy Engine.
              This internal console manages approvals, suspensions, and cryptographic verification. Zero permission to view owner plaintext.
            </p>
          </div>

          <button
            onClick={loadAdminData}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh All</span>
          </button>
        </div>

        {actionMsg && (
          <div className="p-4 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-xs font-mono text-cyan-300">
            {actionMsg}
          </div>
        )}

        {/* Top Section Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3 font-mono text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            1. System Overview
          </button>
          <button
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'registrations'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <span>2. Registration Management</span>
            {pendingUsers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'audits'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            3. Operations & Scheduler
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            4. Security & Verifications
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            5. Policy & Reports
          </button>
        </div>

        {/* ========================================================
            TAB 1: SYSTEM OVERVIEW
            ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
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
                <span className="text-[11px] font-mono text-slate-500 block uppercase">Pending Approval</span>
                <span className="text-2xl font-bold font-serif text-purple-400">
                  {overview?.pending_users ?? pendingUsers.length}
                </span>
              </div>
            </div>

            {/* Daemon Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>AUTOMATED AUDITOR</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ONLINE</span>
                </div>
                <div className="text-sm font-semibold text-white">Autonomous Background Service</div>
                <p className="text-[11px] text-slate-400">
                  Runs scheduled and on-demand audits using receipts & public parameters. No UI login portal.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>AUDIT SCHEDULER</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {scheduler?.status || 'RUNNING'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">Job Loop Interval: {scheduler?.interval_seconds || 60}s</div>
                <p className="text-[11px] text-slate-400">
                  Pending Jobs: {scheduler?.pending_jobs ?? 0} • Running Jobs: {scheduler?.running_jobs ?? 0}
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>POLICY ENGINE</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">ACTIVE</span>
                </div>
                <div className="text-sm font-semibold text-white">Rule-Based Automation</div>
                <p className="text-[11px] text-slate-400">
                  Enforces registration criteria, auto-suspends brute force attacks, and escalates watchdog alerts.
                </p>
              </div>
            </div>

            {/* Quick Status Breakdown */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Account Status Breakdown</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-lg font-bold text-emerald-400">{approvedUsers.length}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Active Accounts</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-lg font-bold text-amber-400">{pendingUsers.length}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Pending Applications</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-lg font-bold text-rose-400">{rejectedUsers.length}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Rejected Applications</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-lg font-bold text-purple-400">{suspendedUsers.length}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Suspended Accounts</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: REGISTRATION MANAGEMENT
            ======================================================== */}
        {activeTab === 'registrations' && (
          <div className="space-y-6">
            <div className="flex gap-2 font-mono text-xs border-b border-slate-800 pb-2">
              <button
                onClick={() => setRegFilter('pending')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  regFilter === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending Applications ({pendingUsers.length})
              </button>
              <button
                onClick={() => setRegFilter('approved')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  regFilter === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Approved Users ({approvedUsers.length})
              </button>
              <button
                onClick={() => setRegFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  regFilter === 'rejected'
                    ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rejected Applications ({rejectedUsers.length})
              </button>
              <button
                onClick={() => setRegFilter('suspended')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  regFilter === 'suspended'
                    ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Suspended Accounts ({suspendedUsers.length})
              </button>
            </div>

            {/* Pending Applications Subtab */}
            {regFilter === 'pending' && (
              <div className="glass-panel rounded-2xl border-slate-800 overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-amber-400" />
                    Pending Owner Registration Applications
                  </h2>
                  <span className="text-xs font-mono text-slate-400">{pendingUsers.length} pending review</span>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="py-12 text-center text-xs font-mono text-slate-500">
                    No pending registration applications requiring review.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 font-mono text-[11px] uppercase">
                          <th className="py-3 px-3">Applicant</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Email Verified</th>
                          <th className="py-3 px-3">Automated Risk Check</th>
                          <th className="py-3 px-3">Applied At</th>
                          <th className="py-3 px-3 text-right">Decision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {pendingUsers.map((u) => {
                          const risk = parseRisk(u.verification_results);
                          return (
                            <tr key={u.id} className="hover:bg-slate-900/40">
                              <td className="py-3 px-3">
                                <div className="text-white font-medium">{u.name || 'Anonymous Applicant'}</div>
                                <div className="text-[10px] text-slate-500">{u.email || u.username}</div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-500/30">
                                  {u.status}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                {u.email_verified ? (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                  </span>
                                ) : (
                                  <span className="text-amber-400 flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> Pending
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                {risk ? (
                                  <div className="text-[10px]">
                                    <span className={`px-1.5 py-0.5 rounded ${
                                      risk.risk_level === 'LOW' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                                    }`}>
                                      Risk: {risk.risk_level} ({risk.risk_score} pts)
                                    </span>
                                    <div className="text-slate-500 mt-0.5">Password: {risk.password_strength}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">Standard Checks</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-400 text-[10px]">
                                {u.created_at ? formatDateTime(u.created_at) : 'N/A'}
                              </td>
                              <td className="py-3 px-3 text-right space-x-2">
                                <button
                                  onClick={() => handleUserAction(u.id, 'approve')}
                                  className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleUserAction(u.id, 'reject')}
                                  className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer"
                                >
                                  Reject...
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
            )}

            {/* Approved Users Subtab */}
            {regFilter === 'approved' && (
              <div className="glass-panel rounded-2xl border-slate-800 overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Approved Active Accounts
                  </h2>
                  <span className="text-xs font-mono text-slate-400">{approvedUsers.length} accounts</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 text-[11px] uppercase">
                        <th className="py-3 px-3">User</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">Approved By</th>
                        <th className="py-3 px-3">Approved At</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {approvedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-3">
                            <div className="text-white font-medium">{u.name || 'Anonymous User'}</div>
                            <div className="text-[10px] text-slate-500">{u.email || u.username}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              u.role === 'ADMIN' ? 'bg-amber-950 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[10px]">
                            {u.approved_by || 'Auto/System'}
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[10px]">
                            {u.approved_at ? formatDateTime(u.approved_at) : formatDateTime(u.created_at)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {u.role !== 'ADMIN' && (
                              <button
                                onClick={() => handleUserAction(u.id, 'suspend')}
                                className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/30 text-[10px] cursor-pointer"
                              >
                                Suspend Account
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rejected Applications Subtab */}
            {regFilter === 'rejected' && (
              <div className="glass-panel rounded-2xl border-slate-800 overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    <UserX className="h-4 w-4 text-rose-400" />
                    Rejected Registration Applications
                  </h2>
                  <span className="text-xs font-mono text-slate-400">{rejectedUsers.length} applications</span>
                </div>

                {rejectedUsers.length === 0 ? (
                  <div className="py-12 text-center text-xs font-mono text-slate-500">
                    No rejected applications recorded.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 text-[11px] uppercase">
                          <th className="py-3 px-3">Applicant</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Mandatory Rejection Reason</th>
                          <th className="py-3 px-3">Rejected By</th>
                          <th className="py-3 px-3">Decision Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {rejectedUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-900/40">
                            <td className="py-3 px-3">
                              <div className="text-white font-medium">{u.name || 'Anonymous User'}</div>
                              <div className="text-[10px] text-slate-500">{u.email || u.username}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/30">
                                REJECTED
                              </span>
                            </td>
                            <td className="py-3 px-3 text-rose-300 font-sans text-xs">
                              {u.rejection_reason || 'Administrative rejection.'}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[10px]">
                              {u.approved_by || 'Admin'}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[10px]">
                              {u.approved_at ? formatDateTime(u.approved_at) : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Suspended Accounts Subtab */}
            {regFilter === 'suspended' && (
              <div className="glass-panel rounded-2xl border-slate-800 overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-purple-400" />
                    Suspended Accounts (Policy Bans / Admin Action)
                  </h2>
                  <span className="text-xs font-mono text-slate-400">{suspendedUsers.length} accounts</span>
                </div>

                {suspendedUsers.length === 0 ? (
                  <div className="py-12 text-center text-xs font-mono text-slate-500">
                    No accounts currently suspended.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 text-[11px] uppercase">
                          <th className="py-3 px-3">User</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Suspended At</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {suspendedUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-900/40">
                            <td className="py-3 px-3">
                              <div className="text-white font-medium">{u.name || 'Anonymous User'}</div>
                              <div className="text-[10px] text-slate-500">{u.email || u.username}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/30">
                                SUSPENDED
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[10px]">
                              {u.approved_at ? formatDateTime(u.approved_at) : 'N/A'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleUserAction(u.id, 'reactivate')}
                                className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 text-[10px] cursor-pointer"
                              >
                                Reactivate Account
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: OPERATIONS & SCHEDULER
            ======================================================== */}
        {activeTab === 'audits' && (
          <div className="space-y-6">
            {/* Scheduler Control Card */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    Automated Background Audit Scheduler
                  </h2>
                  <p className="text-xs text-slate-400">
                    Runs periodic spot-checks across all active delegations using Merkle proofs & HMAC verification.
                  </p>
                </div>

                <button
                  onClick={handleTriggerScheduler}
                  disabled={triggeringScheduler}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                >
                  <Play className={`h-3.5 w-3.5 ${triggeringScheduler ? 'animate-spin' : ''}`} />
                  <span>{triggeringScheduler ? 'Triggering...' : 'Trigger Audit Cycle Now'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Scheduler State</span>
                  <span className="text-emerald-400 font-bold">{scheduler?.status || 'RUNNING'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Loop Interval</span>
                  <span className="text-white font-bold">{scheduler?.interval_seconds || 60} seconds</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Pending Jobs</span>
                  <span className="text-amber-400 font-bold">{scheduler?.pending_jobs ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Running Jobs</span>
                  <span className="text-cyan-400 font-bold">{scheduler?.running_jobs ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Audit Operations Stream */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                Live Audit Operations Feed
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 text-[11px] uppercase">
                      <th className="py-3 px-3">Audit ID</th>
                      <th className="py-3 px-3">Target File</th>
                      <th className="py-3 px-3">Kind</th>
                      <th className="py-3 px-3">Actor / Trigger</th>
                      <th className="py-3 px-3">Verdict</th>
                      <th className="py-3 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(auditOps?.audits || []).slice(0, 15).map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3 text-cyan-400">#{a.id}</td>
                        <td className="py-2.5 px-3 text-white">{a.file_id?.slice(0, 8)}...</td>
                        <td className="py-2.5 px-3 text-slate-300">{a.kind}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                          {a.actor_type || 'SYSTEM'} ({a.trigger || 'MANUAL'})
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'PASS'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                          {formatDateTime(a.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: SECURITY & VERIFICATIONS
            ======================================================== */}
        {activeTab === 'security' && (
          <div className="space-y-6">
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
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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

            {/* Security Events & Failed Verifications Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Security Events */}
              <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  Recent Security Events
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto font-mono text-[11px]">
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

              {/* Failed Verification Monitor */}
              <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  Failed Verification & Anomaly Monitor
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto font-mono text-[11px]">
                  {failedVerifs.length === 0 ? (
                    <div className="text-slate-500 py-6 text-center">No failed verifications detected.</div>
                  ) : (
                    failedVerifs.map((fv) => (
                      <div key={fv.id} className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20 flex justify-between items-center">
                        <div>
                          <div className="text-rose-300 font-semibold">{fv.action}</div>
                          <div className="text-[10px] text-slate-500">{fv.target} • {fv.ip}</div>
                        </div>
                        <div className="text-[10px] text-slate-400">{formatDateTime(fv.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: POLICY & REPORTS
            ======================================================== */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {/* Operational Reports Card */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" />
                Operational System Summary Report
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Total Users</span>
                  <span className="text-white font-bold">{reports?.total_users ?? overview?.total_users ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Total Audits</span>
                  <span className="text-cyan-400 font-bold">{reports?.total_audits ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Pass Rate</span>
                  <span className="text-emerald-400 font-bold">{reports?.pass_rate_percent ?? 100}%</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Ledger Head</span>
                  <span className="text-slate-300 text-[10px] font-mono truncate block">
                    {reports?.ledger_head_hash?.slice(0, 16) || 'Genesis'}...
                  </span>
                </div>
              </div>
            </div>

            {/* Active Policy Config */}
            <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-purple-400" />
                Automated Policy Engine Configuration (policy.yaml)
              </h3>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
                {JSON.stringify(policy || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </CloudBackground>
  );
};

export default AdminPage;
