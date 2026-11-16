import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialToken = searchParams.get('token') || '';
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; message: string; user_status?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (tokenToVerify?: string) => {
    const tok = tokenToVerify || token;
    if (!tok.trim()) {
      setError('Please provide a valid verification token.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.verifyEmail(tok.trim());
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Verification failed. The token may be expired or already used.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      handleVerify(initialToken);
    }
  }, [initialToken]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    try {
      setResending(true);
      setResendMsg(null);
      const res = await api.resendVerification(resendEmail);
      setResendMsg(res.message || 'Verification token sent.');
    } catch (err: any) {
      setError(err.message || 'Could not resend verification.');
    } finally {
      setResending(false);
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
            Email Verification
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Owner Account Activation & Policy Validation
          </p>
        </div>

        <div className="glass-panel p-8 rounded-3xl border-slate-800 shadow-2xl space-y-6">
          {result ? (
            <div className="space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-serif font-bold text-white">Email Verified!</h2>
              <p className="text-xs text-slate-300">
                {result.message}
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300">
                Account Status: <span className="font-bold text-emerald-400">{result.user_status || 'ACTIVE'}</span>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-bold uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-xs font-mono text-slate-300 uppercase">
                  Verification Token
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                    placeholder="Enter or paste token from email/console"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
                <button
                  type="button"
                  onClick={() => handleVerify()}
                  disabled={loading || !token.trim()}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Verifying...' : 'Validate Verification Token'}</span>
                </button>
              </div>

              {/* Resend Section */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <span className="text-[11px] font-mono text-slate-400 block uppercase">
                  Need a fresh token?
                </span>
                {resendMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs">
                    {resendMsg}
                  </div>
                )}
                <form onSubmit={handleResend} className="flex gap-2">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    placeholder="your-email@cloud.local"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={resending || !resendEmail}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 disabled:opacity-50"
                  >
                    {resending ? 'Sending...' : 'Resend'}
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="pt-2 text-center">
            <Link to="/login" className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors">
              ← Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </CloudBackground>
  );
};

export default VerifyEmailPage;
