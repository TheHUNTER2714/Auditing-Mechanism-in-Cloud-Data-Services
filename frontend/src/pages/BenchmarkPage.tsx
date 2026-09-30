import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Cpu, Download, RefreshCw, Activity, Layers, Zap } from 'lucide-react';
import { CloudBackground } from '../components/CloudBackground';
import { api } from '../api/client';
import type { BenchmarkReport } from '../api/types';

export const BenchmarkPage: React.FC = () => {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadBenchmarks = async () => {
    setLoading(true);
    try {
      const data = await api.getBenchmarks();
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenchmarks();
  }, []);

  return (
    <CloudBackground className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono mb-2">
              <Cpu className="h-3.5 w-3.5" />
              <span>Authentic Hardware Benchmarking Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
              Evaluation & Cryptographic Benchmarks
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Strictly measured on this host with 10 repetitions per trial (mean & std dev recorded).
              Never simulated or estimated.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadBenchmarks}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Re-run Benchmarks</span>
            </button>
          </div>
        </div>

        {/* Telemetry Specs Strip */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">HOST PLATFORM</div>
              <div className="text-xs font-mono text-white font-bold truncate mt-0.5">
                {report.telemetry.platform}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">PROCESSOR ARCHITECTURE</div>
              <div className="text-xs font-mono text-cyan-300 font-bold truncate mt-0.5">
                {report.telemetry.processor} ({report.telemetry.cpu_count} Cores)
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">PYTHON RUNTIME</div>
              <div className="text-xs font-mono text-indigo-300 font-bold mt-0.5">
                CPython v{report.telemetry.python_version} ({report.telemetry.architecture})
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">UPDATE SPEEDUP</div>
              <div className="text-xs font-mono text-emerald-400 font-bold mt-0.5">
                {report.update_benchmarks.speedup_ratio}x Faster vs Full Rebuild
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        {report && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart 1: Audit Latency vs File Size */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  1. Audit Execution Time vs File Size
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Comparison between Plain SHA-256, Full Chain Audit, and Sampled Spot-Check (ms)
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.size_benchmarks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="file_size_mb" stroke="#64748b" tickFormatter={(v) => `${v} MB`} />
                    <YAxis stroke="#64748b" unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                      formatter={(val: any) => [`${val} ms`, '']}
                    />
                    <Legend />
                    <Bar dataKey="sha256_ms_mean" name="Plain SHA-256" fill="#38bdf8" />
                    <Bar dataKey="full_chain_ms_mean" name="Full Chain Audit" fill="#818cf8" />
                    <Bar dataKey="spotcheck_ms_mean" name="Sampled Spot-Check" fill="#34d399" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Chain Verification vs Version Count */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  2. Version Chain Verification Latency vs History Depth
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Sequential HMAC-SHA256 signature verification overhead (1 to 250 versions)
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.version_benchmarks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="version_count" stroke="#64748b" tickFormatter={(v) => `V${v}`} />
                    <YAxis stroke="#64748b" unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                      formatter={(val: any) => [`${val} ms`, 'Verification Time']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="verification_time_ms"
                      name="Chain Verification (ms)"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Detection Probability */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl lg:col-span-2">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  3. Corruption Detection Probability: Empirical vs Hypergeometric Theoretical
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Formula: P = 1 - C(n-k, c) / C(n, c) across 1% and 5% corruption levels
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.detection_benchmarks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="sample_size_c"
                      stroke="#64748b"
                      tickFormatter={(v) => `c=${v}`}
                    />
                    <YAxis stroke="#64748b" unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                      formatter={(val: any) => [`${val}%`, '']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="theoretical_prob"
                      name="Theoretical Hypergeometric %"
                      stroke="#38bdf8"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="empirical_prob"
                      name="Empirical Observed %"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </CloudBackground>
  );
};
