import React from 'react';
import { Shield, BookOpen, User, Award, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-cyan-500/15 bg-[#030611] text-slate-400 py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Project Identity */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/30">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="font-serif text-base font-semibold text-white">
              Auditing Mechanism in Cloud Data Services
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            A functional B.Tech engineering prototype implementing{' '}
            <strong className="text-cyan-300 font-medium">Version-Based Dynamic Cloud Data Auditing</strong>.
            Employs secret-anchored HMAC-SHA256 version chaining and owner-held receipts to audit data integrity and detect silent revisionism in simulated cloud storage.
          </p>
          <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800 text-[11px] text-slate-400">
            <span className="font-mono font-semibold text-cyan-400">NOTICE:</span> Storage operations execute on simulated cloud storage. Advanced techniques (PDP, POR, Identity-based auditing, Blockchain) are referenced purely for academic comparison.
          </div>
        </div>

        {/* Middle Column: Academic Credentials */}
        <div>
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-3">
            <Award className="h-4 w-4 text-cyan-400" />
            <span>Academic Project Credentials</span>
          </div>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-mono">INSTITUTION:</span>
              <span className="text-slate-200">
                Bharat Ratna Babasaheb Bhimrao Ambedkar Rajkiya Engineering College, Pratapgarh
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-mono">DEPARTMENT:</span>
              <span className="text-slate-200">Computer Science and Engineering (CSE)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-mono">SUPERVISOR:</span>
              <span className="text-slate-200 font-medium">Dr. Ashish Kumar Mishra</span>
            </li>
          </ul>
        </div>

        {/* Right Column: Project Members */}
        <div>
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-3">
            <User className="h-4 w-4 text-cyan-400" />
            <span>Project Contributors</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="rounded-lg bg-[#07111F] p-2.5 border border-slate-800">
              <div className="font-medium text-slate-200">Ayush Agnihotri</div>
              <div className="font-mono text-[11px] text-cyan-400">Roll No: 2312160100022</div>
              <div className="text-[10px] text-slate-400">B.Tech CSE</div>
            </div>
            <div className="rounded-lg bg-[#07111F] p-2.5 border border-slate-800">
              <div className="font-medium text-slate-200">Vivek Kushwaha</div>
              <div className="font-mono text-[11px] text-cyan-400">Roll No: 2312160100071</div>
              <div className="text-[10px] text-slate-400">B.Tech CSE</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
        <div>
          © 2026 Bharat Ratna Babasaheb Bhimrao Ambedkar Rajkiya Engineering College, Pratapgarh.
        </div>
        <div className="font-mono mt-2 sm:mt-0 text-cyan-500/80">
          PROTOTYPE BT032 • AUDITING MECHANISM IN CLOUD DATA SERVICES
        </div>
      </div>
    </footer>
  );
};
