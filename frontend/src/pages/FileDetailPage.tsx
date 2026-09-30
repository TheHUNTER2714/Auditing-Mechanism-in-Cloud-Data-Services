import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Layers, 
  Shield, 
  Upload, 
  Hash, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  FileText
} from 'lucide-react';
import { fetchFileVersions, runAudit, verifyVersionChain, updateFileVersion, simulateHistoryTamper, fetchConfig } from '../api/client';
import type { VersionRecord, AuditResult, VerifyChainResult, ConfigResponse } from '../api/types';
import { getReceiptForFile } from '../utils/receiptStore';
import { shortHash, formatBytes, formatDateTime } from '../utils/formatters';
import { CloudBackground } from '../components/CloudBackground';

export const FileDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [fileDetails, setFileDetails] = useState<{
    file_id: string;
    display_name: string;
    current_version: number;
    versions: VersionRecord[];
  } | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | VerifyChainResult | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // New version upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [data, cfg] = await Promise.all([fetchFileVersions(id), fetchConfig()]);
      setFileDetails(data);
      setConfig(cfg);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleRunAudit = async () => {
    if (!id) return;
    try {
      setAuditLoading(true);
      const receipt = getReceiptForFile(id);
      const res = await runAudit(id, receipt);
      setAuditResult(res);
      await loadData();
    } catch (err: any) {
      alert(`Audit error: ${err.message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    if (!id) return;
    try {
      setAuditLoading(true);
      const receipt = getReceiptForFile(id);
      const res = await verifyVersionChain(id, receipt);
      setAuditResult(res);
      await loadData();
    } catch (err: any) {
      alert(`Chain verification error: ${err.message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleTamperVersionInDb = async (versionNum: number) => {
    if (!id) return;
    try {
      await simulateHistoryTamper(id, versionNum);
      setActionNotice(`[SIMULATE ATTACKER]: Mutated V${versionNum} content_hash directly in SQLite. Run 'Verify Version Chain' to witness cryptographic break!`);
      setTimeout(() => setActionNotice(null), 8000);
      await loadData();
    } catch (err: any) {
      alert(`Tamper error: ${err.message}`);
    }
  };

  const handleUploadNewVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      setUpdating(true);
      await updateFileVersion(id, file);
      setActionNotice(`Created authorized Version V${(fileDetails?.current_version || 0) + 1}!`);
      setTimeout(() => setActionNotice(null), 5000);
      await loadData();
    } catch (err: any) {
      alert(`Version update failed: ${err.message}`);
    } finally {
      setUpdating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-400 font-mono text-xs">
        Loading version history and cryptographic anchors...
      </div>
    );
  }

  if (!fileDetails) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-white mb-2">File Record Not Found</h2>
        <Link to="/files" className="text-cyan-400 hover:underline text-xs">
          ← Back to files
        </Link>
      </div>
    );
  }

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
      {/* Back button & Title */}
      <div className="mb-6">
        <Link
          to="/files"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Files Inventory</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {fileDetails.display_name}
              </h1>
              <span className="rounded-full bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-0.5 text-xs font-mono text-cyan-300">
                Head: V{fileDetails.current_version}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500">UUID: {fileDetails.file_id}</p>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunAudit}
              disabled={auditLoading}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              <span>Run Full Audit</span>
            </button>
            <button
              onClick={handleVerifyChain}
              disabled={auditLoading}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 px-3.5 py-2 text-xs font-medium transition-all disabled:opacity-50"
            >
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Verify Version Chain</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={updating}
              className="flex items-center gap-1.5 rounded-lg bg-blue-950/40 text-blue-300 border border-blue-500/30 hover:bg-blue-900/40 px-3.5 py-2 text-xs font-medium transition-all disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              <span>{updating ? 'Recording...' : 'Update File (New V)'}</span>
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleUploadNewVersion}
        className="hidden"
      />

      {actionNotice && (
        <div className="mb-6 rounded-lg bg-cyan-950/60 border border-cyan-500/50 p-4 text-xs font-mono text-cyan-300 animate-fadeIn">
          {actionNotice}
        </div>
      )}

      {/* Audit Result Display */}
      {auditResult && (
        <div className="glass-panel rounded-2xl p-6 border-cyan-400/40 mb-8 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg border ${
                auditResult.status === 'PASS' 
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40' 
                  : auditResult.status === 'TAMPERED'
                  ? 'bg-red-950/60 text-red-400 border-red-500/40'
                  : 'bg-amber-950/60 text-amber-400 border-amber-500/40'
              }`}>
                {auditResult.status === 'PASS' && <CheckCircle2 className="h-4 w-4" />}
                {auditResult.status === 'TAMPERED' && <XCircle className="h-4 w-4" />}
                {auditResult.status === 'VERSION_HISTORY_ALTERED' && <AlertTriangle className="h-4 w-4" />}
              </div>
              <span className="font-serif font-bold text-white text-base">
                Audit Result: {auditResult.status}
              </span>
            </div>

            <button
              onClick={() => setAuditResult(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          <div className="text-xs font-mono text-slate-300 mb-3">
            {auditResult.status === 'PASS' && 'All checks passed! Content hash matches recorded head, and HMAC version chain is unbroken.'}
            {auditResult.status === 'TAMPERED' && 'Storage modification detected! Current payload differs from recorded head hash.'}
            {auditResult.status === 'VERSION_HISTORY_ALTERED' && `Version history compromised! ${auditResult.chain_reason || 'Chain signature mismatch.'}`}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
            {auditResult.steps.map((st, i) => (
              <div key={i} className="rounded-lg bg-[#07111F] p-2 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 truncate mr-2">{st.name}</span>
                <span className="text-cyan-400 font-semibold">{st.ms}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Version Chain Visual Timeline */}
      <div className="glass-panel rounded-2xl p-6 border-cyan-500/20">
        <h2 className="text-lg font-serif font-bold text-white mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-cyan-400" />
          Cryptographic Version Chain (HMAC-SHA256)
        </h2>

        <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-blue-500 before:to-slate-800">
          {fileDetails.versions.map((v) => (
            <div key={v.id} className="relative flex items-start gap-4 group">
              {/* Node Badge */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#07111F] border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold shadow-[0_0_15px_rgba(34,211,238,0.2)] z-10">
                V{v.version}
              </div>

              {/* Version Block Content */}
              <div className="glass-panel flex-1 rounded-xl p-4 border-slate-800 group-hover:border-cyan-500/30 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">Version {v.version}</span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                      {v.activity}
                    </span>
                    <span className="text-xs text-slate-400">({formatBytes(v.size_bytes)})</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {formatDateTime(v.created_at)}
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  {/* Content Hash */}
                  <div className="rounded-lg bg-[#07111F]/90 p-2.5 border border-slate-800/80">
                    <div className="text-[10px] uppercase text-slate-500 flex items-center gap-1 mb-0.5">
                      <Hash className="h-3 w-3 text-cyan-400" />
                      <span>SHA-256 Content Digest (D_{v.version})</span>
                    </div>
                    <div className="text-cyan-300 break-all select-all">
                      {v.content_hash}
                    </div>
                  </div>

                  {/* Previous Chain Hash */}
                  <div className="rounded-lg bg-[#07111F]/90 p-2.5 border border-slate-800/80">
                    <div className="text-[10px] uppercase text-slate-500 flex items-center gap-1 mb-0.5">
                      <Layers className="h-3 w-3 text-slate-400" />
                      <span>Previous Chain Hash (HC_{v.version - 1})</span>
                    </div>
                    <div className="text-slate-400 break-all select-all">
                      {v.prev_chain_hash}
                    </div>
                  </div>

                  {/* Version Chain Hash */}
                  <div className="rounded-lg bg-[#07111F]/90 p-2.5 border border-slate-800/80">
                    <div className="text-[10px] uppercase text-slate-500 flex items-center gap-1 mb-0.5">
                      <Shield className="h-3 w-3 text-blue-400" />
                      <span>HMAC-SHA256 Signed Chain Hash (HC_{v.version})</span>
                    </div>
                    <div className="text-blue-300 break-all select-all font-semibold">
                      {v.chain_hash}
                    </div>
                  </div>
                </div>

                {/* Demo Tamper Control for this specific version */}
                {config?.demo_mode && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => handleTamperVersionInDb(v.version)}
                      className="rounded bg-amber-950/40 text-amber-300 border border-amber-500/30 hover:bg-amber-900/60 px-2.5 py-1 text-[11px] font-mono transition-all"
                      title="Mutate this version row in SQLite to demonstrate VERSION_HISTORY_ALTERED"
                    >
                      [Simulate Attacker: Tamper V{v.version} in DB]
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </CloudBackground>
  );
};
