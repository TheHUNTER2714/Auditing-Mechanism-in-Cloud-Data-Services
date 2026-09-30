import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Files,
  UploadCloud,
  FileCheck,
  ShieldCheck,
  Database,
  AlertTriangle,
  Layers,
  BarChart3,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Server,
  User,
  Shield
} from 'lucide-react';
import { api } from '../api/client';
import { CloudBackground } from './CloudBackground';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);
  
  // Current user & role from localStorage
  const username = localStorage.getItem('bt032_auth_username') || 'alice';
  const role = localStorage.getItem('bt032_auth_role') || 'OWNER';

  useEffect(() => {
    api.getAlerts()
      .then((data) => {
        const unack = data.filter((a) => !a.acknowledged).length;
        setAlertCount(unack);
      })
      .catch(() => {});
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('bt032_auth_token');
    localStorage.removeItem('bt032_auth_role');
    localStorage.removeItem('bt032_auth_username');
    navigate('/login');
  };

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Files Inventory', path: '/files', icon: Files },
    { name: 'Upload Data', path: '/upload', icon: UploadCloud },
    { name: 'Audit History', path: '/audits', icon: FileCheck },
    { name: 'TPA Console', path: '/tpa', icon: ShieldCheck },
    { name: 'Simulated Ledger', path: '/ledger', icon: Database },
    { name: 'Security Alerts', path: '/alerts', icon: AlertTriangle, badge: alertCount },
    { name: 'Batch Audit', path: '/batch-audit', icon: Layers },
    { name: 'Benchmarks', path: '/benchmarks', icon: BarChart3 },
  ];

  const roleLabel = role === 'OWNER' ? 'Data Owner' : role === 'TPA' ? 'Third-Party Auditor' : 'System Admin';

  return (
    <div className="min-h-screen bg-[#050816] text-[#F1F5F9] flex flex-col md:flex-row">
      {/* ========================================================
          SIDEBAR (DESKTOP & COLLAPSED MOBILE)
          ======================================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#07111F]/95 backdrop-blur-xl border-r border-slate-800/80 flex flex-col transition-transform duration-300 md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Sidebar Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="font-serif text-sm font-bold text-white tracking-wide leading-none">
                Cloud Audit
              </div>
              <div className="text-[10px] font-mono text-cyan-400 tracking-wider">
                V-DCA PROTOTYPE
              </div>
            </div>
          </Link>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Engine Status Indicator */}
        <div className="mx-4 my-3 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">STORAGE ENGINE</span>
          </div>
          <span className="text-cyan-400 font-semibold">ONLINE</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 ? (
                  <span className="rounded-full bg-red-500 text-white text-[10px] font-mono font-bold px-1.5 py-0.5">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout in Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-white font-medium">
              <User className="h-3.5 w-3.5 text-cyan-400" />
              <span>{username}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>ROLE:</span>
              <span className="text-cyan-300 font-semibold">{roleLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/overview"
              className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-mono flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Overview</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              onClick={handleLogout}
              className="py-1.5 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-white text-[11px] font-mono flex items-center justify-center gap-1 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-3 w-3" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ========================================================
          MAIN CONTENT WRAPPER & APPLICATION TOP BAR
          ======================================================== */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        {/* Application Top Bar */}
        <header className="h-16 px-4 sm:px-6 bg-[#07111F]/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide hidden sm:block">
                Auditing Mechanism in Cloud Data Services
              </h2>
              <div className="text-[11px] font-mono text-slate-400">
                Model: <span className="text-cyan-400">Version-Based Dynamic Cloud Data Auditing</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Public Links */}
            <Link
              to="/"
              className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono text-slate-300 hover:text-white transition-all"
            >
              <span>Public Landing</span>
            </Link>

            <Link
              to="/overview"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono text-cyan-300 hover:text-white transition-all"
            >
              <span>Project Overview</span>
            </Link>

            {/* Role Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/30 text-xs font-mono text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span>{role}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Application Page Outlet */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
