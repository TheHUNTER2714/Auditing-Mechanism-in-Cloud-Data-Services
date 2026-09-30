import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle2, Shield, ArrowRight, Hash, Layers } from 'lucide-react';
import { uploadFile } from '../api/client';
import { shortHash } from '../utils/formatters';
import { CloudBackground } from '../components/CloudBackground';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError(null);
      setResult(null);

      // Visual feedback stages
      setUploadStage('Streaming file bytes to simulated cloud storage...');
      await new Promise((r) => setTimeout(r, 300));
      setUploadStage('Computing SHA-256 content digest (D_1)...');
      await new Promise((r) => setTimeout(r, 300));
      setUploadStage('Generating HMAC-SHA256 Genesis Anchor & V1 Chain Block...');

      const response = await uploadFile(selectedFile);
      setResult(response);
      setUploadStage(null);
    } catch (err: any) {
      setError(err.message || 'File upload failed');
      setUploadStage(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl font-bold text-white tracking-tight mb-2">
          Upload Data to Simulated Cloud Storage
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Every upload registers an immutable cryptographic anchor with SHA-256 digest, HMAC-chained genesis hash, and generates an owner-held verification receipt.
        </p>
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dropzone Container */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`glass-panel cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
              dragActive
                ? 'border-cyan-400 bg-cyan-950/20 scale-[1.01]'
                : 'border-cyan-500/25 hover:border-cyan-400/50 hover:bg-slate-900/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 text-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.2)] mb-4">
              <UploadCloud className="h-8 w-8" />
            </div>

            <div className="text-base font-semibold text-white mb-1">
              {selectedFile ? selectedFile.name : 'Drop your file here or click to browse'}
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-3">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB • Ready for cryptographic ingestion`
                : 'Supports text, CSV, PDF, logs, or application files up to 25 MB'}
            </p>

            {selectedFile && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 px-3 py-1 text-xs font-mono text-cyan-300">
                <FileText className="h-3.5 w-3.5" />
                <span>Selected: {selectedFile.name}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-950/40 border border-red-500/50 p-4 text-xs font-mono text-red-300">
              Error: {error}
            </div>
          )}

          {uploading && (
            <div className="glass-panel rounded-xl p-4 text-center">
              <div className="text-xs font-mono text-cyan-300 animate-pulse mb-2">
                {uploadStage}
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-[progress_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shield className="h-4 w-4" />
              <span>{uploading ? 'Processing Cryptographic Ingestion...' : 'Upload & Anchor Version V1'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Result Confirmation Card */
        <div className="glass-panel rounded-2xl p-8 border-cyan-400/40 shadow-[0_0_35px_rgba(34,211,238,0.15)] animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl font-bold text-white">V1 CREATED</span>
                <span className="rounded-full bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                  RECORDED_VERSION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Data stored in simulated cloud storage and anchored into the version chain.
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-cyan-400" />
                <span>File Metadata</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Name: </span>
                  <span className="text-slate-200 font-medium">{result.display_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">UUID: </span>
                  <span className="text-slate-300 font-mono text-[11px]">{result.file_id}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-cyan-400" />
                <span>SHA-256 Content Digest (D_1)</span>
              </div>
              <div className="font-mono text-xs text-cyan-300 break-all bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                {result.content_hash}
              </div>
            </div>

            <div className="rounded-xl bg-[#07111F] p-4 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                <span>HMAC-SHA256 Version Chain Hash (HC_1)</span>
              </div>
              <div className="font-mono text-xs text-blue-300 break-all bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                {result.chain_hash}
              </div>
            </div>

            <div className="rounded-xl bg-cyan-950/30 border border-cyan-500/20 p-3 text-[11px] text-slate-300 flex items-center justify-between">
              <div>
                <span className="font-mono font-semibold text-cyan-400">OWNER RECEIPT: </span>
                Saved to browser <code className="text-cyan-300">localStorage</code>. Will be submitted during audits to prevent silent rollbacks.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                setResult(null);
                setSelectedFile(null);
              }}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Upload another file
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/files/${result.file_id}`)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white border border-slate-700 transition-all"
              >
                <span>View Version Chain</span>
              </button>
              <button
                onClick={() => navigate(`/files`)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
              >
                <span>Run Integrity Audit</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </CloudBackground>
  );
};
