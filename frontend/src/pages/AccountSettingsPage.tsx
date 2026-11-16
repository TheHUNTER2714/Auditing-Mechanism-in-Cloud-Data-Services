import React, { useEffect, useState } from 'react';
import { Shield, User, Lock, Mail, Key, CheckCircle2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';
import { formatDateTime } from '../utils/formatters';

export const AccountSettingsPage: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await api.getProfile();
      setProfile(data);
      setNameInput(data.name || '');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    try {
      setSavingName(true);
      setNameMsg(null);
      await api.updateProfile(nameInput.trim());
      setNameMsg('Profile name updated successfully.');
      setTimeout(() => setNameMsg(null), 4000);
      await loadProfile();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 12) {
      setPwErr('New password must be at least 12 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr('New passwords do not match.');
      return;
    }

    try {
      setChangingPw(true);
      setPwErr(null);
      setPwMsg(null);
      await api.changePassword(currentPw, newPw);
      setPwMsg('Password changed successfully! All other active sessions have been invalidated.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => setPwMsg(null), 6000);
    } catch (err: any) {
      setPwErr(err.message || 'Failed to change password.');
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-mono text-slate-400">
        Loading account security and profile parameters...
      </div>
    );
  }

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Title */}
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-cyan-400" />
            Owner Profile & Account Security
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your personal profile, update cryptographic passwords, and inspect security telemetry.
          </p>
        </div>

        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 flex items-center justify-center font-bold">
                {profile?.name ? profile.name[0].toUpperCase() : 'U'}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{profile?.name || 'Data Owner'}</h2>
                <p className="text-xs font-mono text-slate-400">{profile?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold">
                ROLE: {profile?.role} (IMMUTABLE)
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono">
                STATUS: {profile?.status}
              </span>
            </div>
          </div>

          {/* Form to update Name */}
          <form onSubmit={handleUpdateName} className="space-y-4 max-w-lg">
            {nameMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{nameMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1.5">
                Display Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={savingName || nameInput === profile?.name}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingName ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-2">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">USER ID</span>
                <span className="text-slate-300 select-all">{profile?.id}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">EMAIL VERIFIED</span>
                <span className="text-emerald-400 font-bold">
                  {profile?.email_verified ? 'YES (VERIFIED)' : 'PENDING'}
                </span>
              </div>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4 max-w-lg">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan-400" />
              Change Account Password
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Updating your password increments your token version, revoking old sessions across all devices.
            </p>
          </div>

          {pwMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{pwMsg}</span>
            </div>
          )}

          {pwErr && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{pwErr}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase mb-1">
                New Password (min 12 chars)
              </label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={changingPw || !currentPw || !newPw || !confirmPw}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50"
            >
              <span>{changingPw ? 'Updating Password...' : 'Update Password & Revoke Old Sessions'}</span>
            </button>
          </form>
        </div>
      </div>
    </CloudBackground>
  );
};

export default AccountSettingsPage;
