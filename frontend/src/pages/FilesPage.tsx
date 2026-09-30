import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Files, 
  Shield, 
  Layers, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Flame
} from 'lucide-react';
import { 
  fetchFiles, 
  runAudit, 
  verifyVersionChain, 
  updateFileVersion, 
  simulateDiskTamper, 
  simulateHistoryTamper, 
  fetchConfig 
} from '../api/client';
import type { FileRecord, AuditResult, VerifyChainResult, ConfigResponse } from '../api/types';
import { getReceiptForFile } from '../utils/receiptStore';
import { shortHash, formatBytes, formatDateTime, getStatusTheme } from '../utils/formatters';
import { CloudBackground } from '../components/CloudBackground';

export const FilesPage: React.FC = () => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAudit, setActiveAudit] = useState<AuditResult | VerifyChainResult | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // File update modal state
  const [updateTargetFile, setUpdateTargetFile] = useState<FileRecord | null>(null);
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const [fList, cfg] = await Promise.all([fetchFiles(), fetchConfig()]);
      setFiles(fList);
      setConfig(cfg);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleRunAudit = async (file: FileRecord) => {
    try {
      setAuditLoading(true);
      const receipt = getReceiptForFile(file.id);
      const result = await runAudit(file.id, receipt);
      setActiveAudit(result);
      await loadFiles();
    } catch (err: any) {
      alert(`Audit error: ${err.message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleVerifyChain = async (file: FileRecord) => {
    try {
      setAuditLoading(true);
      const receipt = getReceiptForFile(file.id);
      const result = await verifyVersionChain(file.id, receipt);
      setActiveAudit(result);
      await loadFiles();
    } catch (err: any) {
      alert(`Chain verification error: ${err.message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  // Demo Tamper Handlers
  const handleTamperFileOnDisk = async (file: FileRecord) => {
    try {
      await simulateDiskTamper(file.id);
      setActionNotice(`[SIMULATE ATTACKER]: Silently injected byte corruption into storage/current/${file.id}. Click 'Run Full Audit' to verify tamper detection!`);
      setTimeout(() => setActionNotice(null), 8000);
      await loadFiles();
    } catch (err: any) {
      alert(`Tamper error: ${err.message}`);
    }
  };

  const handleTamperHistoryInDb = async (file: FileRecord) => {
    try {
      await simulateHistoryTamper(file.id, 1);
      setActionNotice(`[SIMULATE ATTACKER]: Mutated V1 row in SQLite database. Click 'Verify Version Chain' or 'Run Full Audit' to witness VERSION_HISTORY_ALTERED!`);
      setTimeout(() => setActionNotice(null), 8000);
      await loadFiles();
    } catch (err: any) {
      alert(`Tamper error: ${err.message}`);
    }
  };

  const handlePerformUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTargetFile || !updateFile) return;

    try {
      setUpdating(true);
      await updateFileVersion(updateTargetFile.id, updateFile);
      setUpdateTargetFile(null);
      setUpdateFile(null);
      setActionNotice(`Authorized update recorded! Created new version linked in HMAC chain.`);
      setTimeout(() => setActionNotice(null), 4000);
      await loadFiles();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Files className="h-6 w-6 text-cyan-400" />
            Stored Cloud Payloads & Version Chains
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            All files reside in local simulated cloud storage with cryptographic history in SQLite. Run live audits or authorized version updates below.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadFiles}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            to="/upload"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload New File</span>
          </Link>
        </div>
      </div>

      {actionNotice && (
        <div className="mb-6 rounded-lg bg-cyan-950/60 border border-cyan-500/50 p-4 text-xs font-mono text-cyan-300 animate-fadeIn shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          {actionNotice}
        </div>
      )}

      {/* Files Table Card */}
      <div className="glass-panel rounded-2xl overflow-hidden border-cyan-500/20">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-mono">
            Loading cloud storage inventory from SQLite...
          </div>
        ) : files.length === 0 ? (
          <div className="py-16 text-center">
            <Files className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-300 mb-1">No files stored yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Upload a file or load prototype demo data to start auditing version chains.
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-4 py-2 text-xs font-medium hover:bg-cyan-500/30 transition-all"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload First File</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#07111F]/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">File Name & Identifier</th>
                  <th className="py-3 px-3">Head Version</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">SHA-256 Digest</th>
                  <th className="py-3 px-3">Last Audit Status</th>
                  <th className="py-3 px-4 text-right">Integrity Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {files.map((file) => {
                  const statusTheme = getStatusTheme(file.last_audit_status);
                  return (
                    <tr key={file.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Name & UUID */}
                      <td className="py-3.5 px-4">
                        <Link 
                          to={`/files/${file.id}`}
                          className="font-medium text-white hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                        >
                          <span>{file.display_name}</span>
                          <ExternalLink className="h-3 w-3 text-slate-500" />
                        </Link>
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                          {file.id}
                        </div>
                      </td>

                      {/* Version badge */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                          <Layers className="h-3 w-3" />
                          V{file.current_version}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-3.5 px-3 font-mono text-slate-300">
                        {formatBytes(file.size_bytes)}
                      </td>

                      {/* Hash */}
                      <td className="py-3.5 px-3 font-mono text-slate-400">
                        <span title={file.content_hash} className="cursor-help">
                          {shortHash(file.content_hash, 6)}
                        </span>
                      </td>

                      {/* Last Audit Status */}
                      <td className="py-3.5 px-3">
                        {file.last_audit_status ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono border ${statusTheme.bg} ${statusTheme.text} ${statusTheme.border} ${statusTheme.glow}`}>
                            {file.last_audit_status === 'PASS' && <CheckCircle2 className="h-3 w-3" />}
                            {file.last_audit_status === 'TAMPERED' && <XCircle className="h-3 w-3" />}
                            {file.last_audit_status === 'VERSION_HISTORY_ALTERED' && <AlertTriangle className="h-3 w-3" />}
                            <span>{statusTheme.label}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">Not audited yet</span>
                        )}
                        {file.last_audited_at && (
                          <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                            {formatDateTime(file.last_audited_at)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Run Full Audit */}
                          <button
                            onClick={() => handleRunAudit(file)}
                            disabled={auditLoading}
                            className="rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30 px-2.5 py-1.5 text-[11px] font-semibold transition-all shadow-[0_0_10px_rgba(34,211,238,0.15)] disabled:opacity-50"
                            title="Verify both active file SHA-256 and full HMAC version chain"
                          >
                            Run Full Audit
                          </button>

                          {/* Verify Chain */}
                          <button
                            onClick={() => handleVerifyChain(file)}
                            disabled={auditLoading}
                            className="rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 px-2.5 py-1.5 text-[11px] font-medium transition-all disabled:opacity-50"
                            title="Verify HMAC signature chain continuity without inspecting active payload"
                          >
                            Verify Chain
                          </button>

                          {/* Authorized Update */}
                          <button
                            onClick={() => {
                              setUpdateTargetFile(file);
                              fileInputRef.current?.click();
                            }}
                            className="rounded-lg bg-blue-950/40 text-blue-300 border border-blue-500/30 hover:bg-blue-900/40 px-2.5 py-1.5 text-[11px] font-medium transition-all"
                            title="Authorize and append a new version to the chain"
                          >
                            Update File
                          </button>

                          {/* Demo Tamper Buttons (gated) */}
                          {config?.demo_mode && (
                            <div className="flex items-center gap-1 border-l border-slate-700/60 pl-1.5 ml-1">
                              <button
                                onClick={() => handleTamperFileOnDisk(file)}
                                className="rounded bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/60 px-2 py-1 text-[10px] font-mono transition-all"
                                title="DEMO: Corrupt active file on disk to trigger TAMPERED"
                              >
                                [Tamper Disk]
                              </button>
                              <button
                                onClick={() => handleTamperHistoryInDb(file)}
                                className="rounded bg-amber-950/40 text-amber-300 border border-amber-500/30 hover:bg-amber-900/60 px-2 py-1 text-[10px] font-mono transition-all"
                                title="DEMO: Edit V1 row in SQLite to trigger VERSION_HISTORY_ALTERED"
                              >
                                [Tamper DB]
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden file input for Authorized Update */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setUpdateFile(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Authorized Update Confirmation Modal */}
      {updateTargetFile && updateFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border-cyan-500/40 shadow-[0_0_35px_rgba(34,211,238,0.2)]">
            <h3 className="font-serif text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-400" />
              Authorize Version Update
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              You are appending an authorized revision to <strong className="text-white">{updateTargetFile.display_name}</strong>. This creates Version V{updateTargetFile.current_version + 1} chained cryptographically to the current head.
            </p>

            <div className="rounded-xl bg-[#07111F] p-3.5 border border-slate-800 text-xs space-y-1.5 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Selected File:</span>
                <span className="text-cyan-300 font-medium">{updateFile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">File Size:</span>
                <span className="font-mono text-slate-300">{formatBytes(updateFile.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Target Version:</span>
                <span className="font-mono text-emerald-400">V{updateTargetFile.current_version + 1}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setUpdateTargetFile(null);
                  setUpdateFile(null);
                }}
                className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePerformUpdate}
                disabled={updating}
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] disabled:opacity-50"
              >
                {updating ? 'Recording Version...' : 'Record Authorized Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Result Modal with Real Execution Steps */}
      {activeAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl p-6 border-cyan-500/40 shadow-[0_0_40px_rgba(34,211,238,0.25)] animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  activeAudit.status === 'PASS' 
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40' 
                    : activeAudit.status === 'TAMPERED'
                    ? 'bg-red-950/60 text-red-400 border-red-500/40'
                    : 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                }`}>
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-serif text-lg font-bold text-white">
                    {activeAudit.status === 'PASS' && 'Data Integrity Verified (PASS)'}
                    {activeAudit.status === 'TAMPERED' && 'Storage Corruption Detected (TAMPERED)'}
                    {activeAudit.status === 'VERSION_HISTORY_ALTERED' && 'Cryptographic Chain Broken (VERSION_HISTORY_ALTERED)'}
                  </div>
                  <div className="text-xs text-slate-400">
                    File: <span className="text-slate-200 font-medium">{activeAudit.display_name}</span> ({activeAudit.file_id})
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveAudit(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Verdict Explanation Banner */}
            <div className={`rounded-xl p-4 border text-xs leading-relaxed mb-4 ${
              activeAudit.status === 'PASS'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : activeAudit.status === 'TAMPERED'
                ? 'bg-red-950/30 border-red-500/30 text-red-300'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            }`}>
              {activeAudit.status === 'PASS' && (
                <div>
                  <strong>VERIFIED INTEGRITY:</strong> The active storage payload SHA-256 matches the recorded head version digest exactly, and every previous version's HMAC signature is cryptographically continuous.
                </div>
              )}
              {activeAudit.status === 'TAMPERED' && (
                <div>
                  <strong>ACTIVE PAYLOAD TAMPER DETECTED:</strong> The file on disk does not match the recorded SHA-256 digest in the database. 
                  {'content_hash_actual' in activeAudit && activeAudit.content_hash_actual === 'FILE_MISSING' 
                    ? ' (Reason: Active storage payload is missing from disk).' 
                    : ' (Silent unauthorized modification detected on disk).'}
                </div>
              )}
              {activeAudit.status === 'VERSION_HISTORY_ALTERED' && (
                <div>
                  <strong>VERSION REVISIONISM DETECTED:</strong> The version history chain has been tampered with or rolled back. 
                  {'first_bad_version' in activeAudit && activeAudit.first_bad_version 
                    ? ` Discrepancy observed at Version V${activeAudit.first_bad_version}.` 
                    : ''}
                  {activeAudit.chain_reason ? ` Details: ${activeAudit.chain_reason}` : ''}
                </div>
              )}
            </div>

            {/* Real Stopwatch Steps from Backend */}
            <div className="mb-4">
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                <span>Verification Stages & Stopwatch Timings (Actual Backend Execution)</span>
              </div>
              <div className="space-y-1.5">
                {activeAudit.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-[#07111F] px-3 py-2 border border-slate-800 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      {st.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="text-slate-200">{st.name}</span>
                    </div>
                    <div className="text-cyan-400 text-[11px]">
                      {st.ms} ms
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveAudit(null)}
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
              >
                Acknowledge Verdict
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </CloudBackground>
  );
};
