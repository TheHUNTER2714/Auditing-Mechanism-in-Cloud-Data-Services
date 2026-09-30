import type {
  AuditHistoryRecord,
  AuditResult,
  BatchAuditResult,
  BenchmarkReport,
  ChallengeResponse,
  ConfigResponse,
  FileRecord,
  HealthResponse,
  LedgerEntry,
  LedgerVerifyResult,
  ProofResponse,
  Receipt,
  StatsResponse,
  UserSession,
  VerifyChainResult,
  VerifyProofResult,
  VersionRecord,
  AlertRecord,
  ScheduleRecord,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('bt032_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorPayload: any = {};
    try {
      errorPayload = await res.json();
    } catch {
      errorPayload = { message: res.statusText };
    }
    const err: any = new Error(errorPayload.message || errorPayload.error || 'API Request Failed');
    err.status = res.status;
    err.payload = errorPayload;
    throw err;
  }
  return res.json();
}

export const api = {
  // System
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/api/health`);
    return handleResponse(res);
  },

  async getConfig(): Promise<ConfigResponse> {
    const res = await fetch(`${API_BASE}/api/config`);
    return handleResponse(res);
  },

  async getStats(): Promise<StatsResponse> {
    const res = await fetch(`${API_BASE}/api/stats`);
    return handleResponse(res);
  },

  // Auth
  async login(username: string, password: string): Promise<UserSession> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const session = await handleResponse<UserSession>(res);
    localStorage.setItem('bt032_auth_token', session.token);
    localStorage.setItem('bt032_auth_role', session.role);
    localStorage.setItem('bt032_auth_username', session.username);
    return session;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  logout() {
    localStorage.removeItem('bt032_auth_token');
    localStorage.removeItem('bt032_auth_role');
    localStorage.removeItem('bt032_auth_username');
  },

  // Files
  async listFiles(): Promise<FileRecord[]> {
    const res = await fetch(`${API_BASE}/api/files`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getFileVersions(fileId: string): Promise<{ file_id: string; display_name: string; current_version: number; versions: VersionRecord[] }> {
    const res = await fetch(`${API_BASE}/api/files/${fileId}/versions`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async uploadFile(formData: FormData): Promise<{ status: string; file_id: string; display_name: string; version: number; content_hash: string; chain_hash: string; receipt: Receipt }> {
    const res = await fetch(`${API_BASE}/api/files`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return handleResponse(res);
  },

  async updateFileVersion(fileId: string, formData: FormData): Promise<{ status: string; file_id: string; display_name: string; version: number; content_hash: string; chain_hash: string; receipt: Receipt }> {
    const res = await fetch(`${API_BASE}/api/files/${fileId}/versions`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return handleResponse(res);
  },

  async dynamicBlockOperation(fileId: string, op: 'modify' | 'insert' | 'append' | 'delete', index: number, data?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/files/${fileId}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ op, index, data: data || '' }),
    });
    return handleResponse(res);
  },

  async deleteFile(fileId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/files/${fileId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  getDownloadUrl(fileId: string): string {
    const token = localStorage.getItem('bt032_auth_token') || '';
    return `${API_BASE}/api/files/${fileId}/download?token=${encodeURIComponent(token)}`;
  },

  // Auditing & Spot-Check
  async auditFile(fileId: string, receipt?: Receipt | null): Promise<AuditResult> {
    const res = await fetch(`${API_BASE}/api/files/${fileId}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ receipt: receipt || undefined }),
    });
    return handleResponse(res);
  },

  async verifyChain(fileId: string, receipt?: Receipt | null): Promise<VerifyChainResult> {
    const res = await fetch(`${API_BASE}/api/files/${fileId}/verify-chain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ receipt: receipt || undefined }),
    });
    return handleResponse(res);
  },

  async requestChallenge(fileId?: string, blindedTag?: string): Promise<ChallengeResponse> {
    const res = await fetch(`${API_BASE}/api/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ file_id: fileId, blinded_tag: blindedTag }),
    });
    return handleResponse(res);
  },

  async getProof(fileId: string, version: number, indices: number[]): Promise<ProofResponse> {
    const res = await fetch(`${API_BASE}/api/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ file_id: fileId, version, indices }),
    });
    return handleResponse(res);
  },

  async verifyProof(proofPayload: ProofResponse): Promise<VerifyProofResult> {
    const res = await fetch(`${API_BASE}/api/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(proofPayload),
    });
    return handleResponse(res);
  },

  async batchAudit(fileIds?: string[]): Promise<BatchAuditResult> {
    const res = await fetch(`${API_BASE}/api/audit/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ file_ids: fileIds }),
    });
    return handleResponse(res);
  },

  async getExpectedChallenge(fileId: string, bucket?: number): Promise<any> {
    const url = bucket
      ? `${API_BASE}/api/files/${fileId}/expected-challenge?bucket=${bucket}`
      : `${API_BASE}/api/files/${fileId}/expected-challenge`;
    const res = await fetch(url, { headers: getAuthHeader() });
    return handleResponse(res);
  },

  async listAudits(fileId?: string, status?: string): Promise<AuditHistoryRecord[]> {
    const params = new URLSearchParams();
    if (fileId) params.append('file_id', fileId);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/api/audits?${params.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Simulated Blockchain Ledger
  async getLedger(fromSeq: number = 1, toSeq: number = 1000): Promise<LedgerEntry[]> {
    const res = await fetch(`${API_BASE}/api/ledger?from=${fromSeq}&to=${toSeq}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async verifyLedger(): Promise<LedgerVerifyResult> {
    const res = await fetch(`${API_BASE}/api/ledger/verify`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Ownership & Dedup
  async getOwnership(fileHash: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/ownership/${fileHash}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async checkOwnership(fileHash: string, blindedOwner: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/ownership/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ file_hash: fileHash, blinded_owner: blindedOwner }),
    });
    return handleResponse(res);
  },

  // Alerts & Reports & Schedules
  async getAlerts(): Promise<AlertRecord[]> {
    const res = await fetch(`${API_BASE}/api/alerts`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async ackAlert(alertId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/api/alerts/${alertId}/ack`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getSchedules(): Promise<ScheduleRecord[]> {
    const res = await fetch(`${API_BASE}/api/schedules`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createSchedule(intervalMinutes: number, fileId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ interval_minutes: intervalMinutes, file_id: fileId }),
    });
    return handleResponse(res);
  },

  async getEvents(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/events`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getBenchmarks(): Promise<BenchmarkReport> {
    const res = await fetch(`${API_BASE}/api/benchmarks`);
    return handleResponse(res);
  },

  getReportCsvUrl(): string {
    return `${API_BASE}/api/reports/audits.csv`;
  },

  getReportPdfUrl(): string {
    return `${API_BASE}/api/reports/audits.pdf`;
  },

  // Attacker Simulation
  async tamperFile(fileId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/demo/tamper-file/${fileId}`, { method: 'POST' });
    return handleResponse(res);
  },

  async tamperBlock(fileId: string, blockIndex: number = 0): Promise<any> {
    const res = await fetch(`${API_BASE}/api/demo/tamper-block/${fileId}?i=${blockIndex}`, { method: 'POST' });
    return handleResponse(res);
  },

  async tamperHistory(fileId: string, version: number = 1): Promise<any> {
    const res = await fetch(`${API_BASE}/api/demo/tamper-history/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    });
    return handleResponse(res);
  },

  async tamperLedger(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/demo/tamper-ledger`, { method: 'POST' });
    return handleResponse(res);
  },

  async resetDemo(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/demo/reset`, { method: 'POST' });
    return handleResponse(res);
  },

  async seedDemo(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/demo/seed`, { method: 'POST' });
    return handleResponse(res);
  },
};

// Convenience legacy export aliases
export const fetchHealth = api.getHealth;
export const fetchConfig = api.getConfig;
export const fetchStats = api.getStats;
export const fetchFiles = api.listFiles;
export const fetchFileVersions = api.getFileVersions;

export const fetchAudits = (arg?: string | { file_id?: string; status?: string }, maybeStatus?: string) => {
  if (typeof arg === 'object' && arg !== null) {
    return api.listAudits(arg.file_id, arg.status);
  }
  return api.listAudits(arg, maybeStatus);
};

export const runAudit = api.auditFile;
export const verifyChain = api.verifyChain;
export const verifyVersionChain = api.verifyChain;

export const uploadFile = async (fileOrFormData: File | FormData) => {
  if (fileOrFormData instanceof FormData) {
    return api.uploadFile(fileOrFormData);
  }
  const fd = new FormData();
  fd.append('file', fileOrFormData);
  return api.uploadFile(fd);
};

export const updateFileVersion = async (fileId: string, fileOrFormData: File | FormData) => {
  if (fileOrFormData instanceof FormData) {
    return api.updateFileVersion(fileId, fileOrFormData);
  }
  const fd = new FormData();
  fd.append('file', fileOrFormData);
  return api.updateFileVersion(fileId, fd);
};

export const simulateDiskTamper = api.tamperFile;
export const simulateHistoryTamper = api.tamperHistory;
export const demoTamperFile = api.tamperFile;
export const demoTamperHistory = api.tamperHistory;
export const demoReset = api.resetDemo;
export const demoSeed = api.seedDemo;

