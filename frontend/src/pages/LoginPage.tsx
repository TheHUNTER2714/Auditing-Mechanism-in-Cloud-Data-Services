import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';

export const LoginPage: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState(isAdmin ? 'admin' : 'alice');
  const [password, setPassword] = useState(isAdmin ? 'AdminSecretPass123!' : 'password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = isAdmin
        ? await api.adminLogin(username, password)
        : await api.login(username, password);
      localStorage.setItem('bt032_auth_token', res.token);
      localStorage.setItem('bt032_auth_role', res.role);
      localStorage.setItem('bt032_auth_username', res.username);
      navigate(isAdmin ? '/dashboard' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or unapproved account');
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <CloudBackground className="min-h-screen flex flex-col justify-between py-12 px-6">
      <div className="max-w-md w-full mx-auto my-auto space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 p-2 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 mb-2">
            <Shield className="h-6 w-6" />
          </Link>
          <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
            {isAdmin ? 'Break-Glass Admin Sign In' : 'Owner Sign In'}
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            {isAdmin
              ? 'CLI-Created Human Administrator Break-Glass Portal'
              : 'Data Owner Authentication & Cryptographic Anchor Portal'}
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-8 rounded-3xl border-slate-800 shadow-2xl space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                {isAdmin ? 'Admin Username' : 'Owner Username / Email'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  placeholder={isAdmin ? 'admin' : 'alice@cloud.local'}
                />
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-bold uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : `Sign In as ${isAdmin ? 'Admin' : 'Owner'}`}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Credentials & Service Note */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-mono text-slate-500 block uppercase">
              {isAdmin ? 'Break-Glass Credentials:' : 'Owner Credentials:'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPreset(isAdmin ? 'admin' : 'alice', isAdmin ? 'AdminSecretPass123!' : 'password123')}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-300 text-center transition-all"
              >
                {isAdmin ? 'Admin (admin)' : 'Owner (alice)'}
              </button>
              <Link
                to={isAdmin ? '/login' : '/admin/login'}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 text-center transition-all flex items-center justify-center"
              >
                {isAdmin ? 'Switch to Owner' : 'Switch to Admin'}
              </Link>
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-500 text-center">
              Auditor Service has no UI login: it operates autonomously via daemon API credentials.
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link to="/" className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors">
            ← Return to Public Website
          </Link>
        </div>
      </div>

      <div className="text-center text-[10px] font-mono text-slate-600">
        Auditing Mechanism in Cloud Data Services • Version-Based Dynamic Cloud Data Auditing
      </div>
    </CloudBackground>
  );
};

export default LoginPage;
