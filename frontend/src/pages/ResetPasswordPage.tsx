import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, ArrowRight, CheckCircle2, AlertCircle, Check, X } from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [inputToken, setInputToken] = useState(token);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checks = {
    length: newPassword.length >= 12,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    numberOrSpecial: /[\d\W_]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };
  const isPasswordValid = checks.length && checks.upper && checks.lower && checks.numberOrSpecial && checks.match;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken) {
      setError('Password reset token is required.');
      return;
    }
    if (!isPasswordValid) {
      setError('Please satisfy all password complexity and matching requirements.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.resetPassword(inputToken, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Password reset failed. The token may be expired or already used.');
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
            Reset Password
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Cryptographic Credential Update & Session Invalidation
          </p>
        </div>

        <div className="glass-panel p-8 rounded-3xl border-slate-800 shadow-2xl space-y-6">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-serif font-bold text-white">Password Updated!</h2>
              <p className="text-xs text-slate-300">
                Your password has been successfully reset. All prior active sessions have been invalidated for security.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-bold uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
              >
                <span>Sign In with New Password</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!token && (
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                    Reset Token
                  </label>
                  <input
                    type="text"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    required
                    placeholder="Enter reset token from mailer"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              {/* Password checks */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] font-mono space-y-1">
                <div className="text-slate-400 mb-1 font-semibold uppercase">Requirements:</div>
                <div className={`flex items-center gap-1.5 ${checks.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>Minimum 12 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.upper ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.upper ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>At least one uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.lower ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.lower ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>At least one lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.numberOrSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.numberOrSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>At least one number or special character</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.match ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.match ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>Passwords match</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-bold uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.25)] disabled:opacity-50"
              >
                <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link to="/login" className="text-xs font-mono text-slate-400 hover:text-cyan-400">
              ← Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </CloudBackground>
  );
};

export default ResetPasswordPage;
