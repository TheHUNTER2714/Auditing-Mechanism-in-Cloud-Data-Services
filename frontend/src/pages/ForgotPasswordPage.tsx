import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentToken, setSentToken] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.forgotPassword(email);
      setMsg(res.message);
      if (res.reset_token) {
        setSentToken(res.reset_token);
      }
    } catch (err: any) {
      setError(err.message || 'Could not process password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CloudBackground className="min-h-screen flex flex-col justify-between py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 p-2 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 mb-1">
            <Shield className="h-6 w-6" />
          </Link>
          <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
            Forgot Password
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Secure Account Recovery & Session Revocation
          </p>
        </div>

        <div className="glass-panel p-8 rounded-3xl border-slate-800 shadow-2xl space-y-6">
          {msg ? (
            <div className="space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-serif font-bold text-white">Reset Link Dispatched</h2>
              <p className="text-xs text-slate-300">{msg}</p>
              {sentToken && (
                <div className="pt-2">
                  <Link
                    to={`/reset-password?token=${sentToken}`}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Proceed to Password Reset (Dev Link)</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
              <div className="pt-2">
                <Link to="/login" className="text-xs font-mono text-slate-400 hover:text-cyan-400">
                  ← Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                  Account Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="e.g. alice@university.edu"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-bold uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.25)] disabled:opacity-50"
              >
                <span>{loading ? 'Sending Request...' : 'Send Password Reset Link'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-mono text-slate-400 hover:text-white transition-colors">
                  ← Remembered your password? Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </CloudBackground>
  );
};

export default ForgotPasswordPage;
