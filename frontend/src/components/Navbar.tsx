import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Bell, Database, Activity, Cpu, Layers } from 'lucide-react';
import { api } from '../api/client';
import type { StatsResponse, UserRole } from '../api/types';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(
    (localStorage.getItem('bt032_auth_role') as UserRole) || 'OWNER'
  );

  const loadStatus = async () => {
    try {
      await api.getHealth();
      setIsOnline(true);
      const s = await api.getStats();
      setStats(s);
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleChange = async (newRole: UserRole) => {
    setCurrentRole(newRole);
    // Demo auto-login for selected role
    const credentials: Record<UserRole, { u: string; p: string }> = {
      OWNER: { u: 'owner@cloud.local', p: 'OwnerPass123!' },
      TPA: { u: 'tpa@audit.org', p: 'TpaPass123!' },
      ADMIN: { u: 'admin@system.local', p: 'AdminPass123!' },
    };
    try {
      await api.login(credentials[newRole].u, credentials[newRole].p);
    } catch {
      // Fallback local storage setting
      localStorage.setItem('bt032_auth_role', newRole);
    }
  };

  const navLinks = [
    { to: '/', label: 'Overview' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/files', label: 'Files' },
    { to: '/tpa', label: 'TPA Console' },
    { to: '/ledger', label: 'Ledger' },
    { to: '/benchmarks', label: 'Benchmarks' },
    { to: '/batch-audit', label: 'Batch Audit' },
    { to: '/alerts', label: 'Alerts', badge: stats?.active_alerts },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#050816]/85 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Project Title Branding */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/30 to-blue-600/30 border border-cyan-400/50 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-all">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm sm:text-base font-semibold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                Auditing Mechanism in Cloud Data Services
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-wider text-slate-400">
              Version-Based Dynamic Cloud Data Auditing
            </p>
          </div>
        </Link>

        {/* Navigation Items with Dribbble glow */}
        <nav className="hidden lg:flex items-center gap-5">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="relative py-1 text-xs font-mono tracking-wider uppercase transition-colors text-slate-300 hover:text-white flex items-center gap-1.5"
              >
                <span className={isActive ? 'text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'}>
                  {link.label}
                </span>
                {Boolean(link.badge) && link.badge! > 0 && (
                  <span className="flex items-center justify-center px-1.5 py-0.2 text-[9px] font-mono font-bold rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/50">
                    {link.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full shadow-[0_0_10px_#06b6d4]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Role Switcher & Live Engine Status */}
        <div className="flex items-center gap-3">
          {/* Role Switcher Pill */}
          <div className="flex items-center rounded-xl bg-slate-900/80 p-0.5 border border-cyan-500/30 text-[10px] font-mono shadow-inner">
            {(['OWNER', 'TPA', 'ADMIN'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  currentRole === r
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Engine Status indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] border ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-950/40 text-rose-400 border-rose-500/40'
            }`}
            title="Backend state indicator"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* Ingest Action CTA */}
          <Link
            to="/upload"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold px-3.5 py-1.5 text-xs tracking-wide transition-all shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:scale-105"
          >
            <span>+ Ingest</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
