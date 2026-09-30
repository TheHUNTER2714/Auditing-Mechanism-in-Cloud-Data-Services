import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, ArrowRight, LayoutDashboard, FileText } from 'lucide-react';

export const PublicNavbar: React.FC = () => {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#02040A]/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 group-hover:scale-105 transition-transform">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="font-serif text-sm sm:text-base font-bold text-white tracking-wide">
              Auditing Mechanism in Cloud Data Services
            </div>
            <div className="text-[10px] font-mono text-cyan-400 tracking-wider">
              MODEL: VERSION-BASED DYNAMIC CLOUD DATA AUDITING
            </div>
          </div>
        </Link>

        {/* Public Navigation */}
        <nav className="flex items-center gap-3 sm:gap-6 text-xs font-mono">
          <Link
            to="/"
            className={`transition-colors hidden sm:block ${
              location.pathname === '/' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Home
          </Link>

          <a
            href="/#about"
            className="text-slate-400 hover:text-cyan-300 transition-colors hidden md:block"
          >
            About
          </a>

          <a
            href="/#project-info"
            className="text-slate-400 hover:text-cyan-300 transition-colors hidden md:block"
          >
            Project Info
          </a>

          <Link
            to="/overview"
            className={`transition-colors ${
              location.pathname === '/overview' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Project Overview
          </Link>

          <Link
            to="/login"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 font-medium transition-all shadow-[0_0_12px_rgba(34,211,238,0.2)] hover:scale-105"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
};
