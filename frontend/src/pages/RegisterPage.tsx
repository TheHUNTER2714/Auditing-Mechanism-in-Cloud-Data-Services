import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, Mail, ArrowRight, CheckCircle2, AlertCircle, Check, X } from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from '../components/CloudBackground';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ email: string; token?: string } | null>(null);

  // Real-time password requirement checks
  const checks = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    numberOrSpecial: /[\d\W_]/.test(password),
    match: password.length > 0 && password === confirmPassword,
  };
  const isPasswordValid = checks.length && checks.upper && checks.lower && checks.numberOrSpecial && checks.match;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please satisfy all password complexity and matching requirements.');
      return;
    }
    if (!acceptTerms) {
      setError('You must accept the terms and conditions.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.register(name, email, password);
      setSuccessInfo({ email, token: res.verification_token });
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CloudBackground className="min-h-screen flex flex-col justify-between py-10 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 p-2 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 mb-1">
            <Shield className="h-6 w-6" />
          </Link>
          <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
            Create Owner Account
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Version-Based Dynamic Cloud Data Auditing (V-DCA)
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-3xl border-slate-800 shadow-2xl space-y-6">
          {successInfo ? (
            <div className="space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-serif font-bold text-white">Registration Successful!</h2>
              <p className="text-xs text-slate-300">
                A single-use verification token has been generated for <span className="text-cyan-300 font-mono">{successInfo.email}</span>.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 text-left space-y-1">
                <div className="text-cyan-400 font-semibold uppercase text-[10px]">Dev Console Mailer Notice:</div>
                <div>Check your backend terminal logs for the dev verification link, or proceed directly:</div>
              </div>
              {successInfo.token && (
                <Link
                  to={`/verify-email?token=${successInfo.token}`}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>1-Click Dev Email Verification</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/login"
                className="inline-block text-xs font-mono text-slate-400 hover:text-white transition-colors"
              >
                Already verified? Proceed to Sign In →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. Alice Johnson"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. alice@university.edu"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
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
                    placeholder="••••••••••••"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                    placeholder="••••••••••••"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              {/* Password Requirements List */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] font-mono space-y-1">
                <div className="text-slate-400 mb-1 font-semibold uppercase">Security Criteria:</div>
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

              {/* Terms Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="terms" className="text-[11px] text-slate-400 cursor-pointer">
                  I accept the security terms & cryptographic verification rules
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid || !acceptTerms}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-bold uppercase tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{loading ? 'Creating Account...' : 'Register as Data Owner'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* Switch to login */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <span className="text-xs text-slate-400">Already registered? </span>
            <Link to="/login" className="text-xs text-cyan-400 font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link to="/" className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors">
            ← Return to Public Website
          </Link>
        </div>
      </div>
    </CloudBackground>
  );
};

export default RegisterPage;
