export type UserRole = 'OWNER' | 'TPA' | 'ADMIN';

export interface UserSession {
  token: string;
  role: UserRole;
  user_id: string;
  username: string;
}

export interface Receipt {
  file_id: string;
  version: number;
  chain_hash: string;
  created_at: string;
  merkle_root?: string;
  ledger_seq?: number;
}

export interface FileRecord {
  id: string;
  display_name: string;
  created_at: string;
  current_version: number;
  size_bytes: number;
  content_hash: string;
  merkle_root?: string;
  chain_hash: string;
  last_audit_status?: string | null;
  last_audited_at?: string | null;
}

export interface VersionRecord {
  id: number;
  file_id: string;
  version: number;
  content_hash: string;
  prev_chain_hash: string;
  chain_hash: string;
  size_bytes: number;
  created_at: string;
  activity: string;
  merkle_root?: string;
  tag_root?: string;
}

export interface AuditStep {
  name: string;
  ok: boolean;
  ms: number;
}

export interface AuditResult {
  status: 'PASS' | 'TAMPERED' | 'VERSION_HISTORY_ALTERED';
  file_id: string;
  display_name?: string;
  checked_version: number;
  content_hash_expected: string;
  content_hash_actual: string;
  content_ok: boolean;
  chain_valid: boolean;
  first_bad_version: number | null;
  chain_reason: string | null;
  receipt_checked: boolean;
  steps: AuditStep[];
  audited_at: string;
}

export interface VerifyChainResult {
  status: 'PASS' | 'VERSION_HISTORY_ALTERED';
  file_id: string;
  display_name?: string;
  current_version: number;
  chain_valid: boolean;
  first_bad_version: number | null;
  chain_reason: string | null;
  receipt_checked: boolean;
  steps: AuditStep[];
  audited_at: string;
}

export interface AuditHistoryRecord {
  id: number;
  file_id: string;
  display_name?: string;
  kind: 'AUDIT' | 'VERIFY_CHAIN' | 'SPOT_CHECK';
  status: 'PASS' | 'TAMPERED' | 'VERSION_HISTORY_ALTERED';
  details_json: string;
  details: any;
  created_at: string;
}

export interface StatsResponse {
  total_files: number;
  total_versions: number;
  audits_performed: number;
  tamper_events: number;
  active_alerts?: number;
  version_chain_status: string;
  is_demo_seeded: boolean;
  storage_infrastructure: string;
  ledger_type?: string;
}

export interface ConfigResponse {
  demo_mode: boolean;
  max_upload_mb: number;
  block_size_bytes?: number;
  time_bucket_seconds?: number;
  storage_type: string;
}

export interface HealthResponse {
  status: string;
  project_title: string;
  model_name: string;
  storage_infrastructure: string;
  timestamp: string;
}

export interface ChallengeResponse {
  file_id: string;
  version: number;
  seed: string;
  time_bucket: number;
  block_count: number;
  challenged_indices: number[];
  ledger_seq: number;
}

export interface MerkleProofStep {
  position: 'left' | 'right' | 'promoted';
  hash: string | null;
}

export interface SampledProof {
  index: number;
  block_bytes_hex: string;
  merkle_proof: MerkleProofStep[];
  tag: string;
}

export interface ProofResponse {
  file_id: string;
  version: number;
  merkle_root: string;
  block_count: number;
  sampled_proofs: SampledProof[];
}

export interface VerifyProofResult {
  status: 'PASS' | 'TAMPERED';
  passed: boolean;
  message: string;
  ledger_seq: number;
  verification_steps: Array<{
    index: number;
    passed: boolean;
    reason: string;
  }>;
}

export interface BatchAuditResult {
  status: 'PASS' | 'TAMPERED';
  batch_seq: number;
  total_files: number;
  passed_files: number;
  failed_files: number;
  results: Array<{
    file_id: string;
    display_name: string;
    version: number;
    status: 'PASS' | 'TAMPERED';
    passed: boolean;
    sampled_indices: number[];
    message: string;
  }>;
}

export interface LedgerEntry {
  seq: number;
  entry_type: 'GENESIS' | 'AUDIT_RESULT' | 'CHALLENGE_SEED' | 'DEDUP_REGISTER' | 'RECEIPT' | 'ALERT';
  payload_json: string;
  payload: any;
  prev_hash: string;
  entry_hash: string;
  created_at: string;
}

export interface LedgerVerifyResult {
  status: 'PASS' | 'LEDGER_ALTERED';
  chain_valid: boolean;
  first_bad_seq: number | null;
  error_message: string | null;
}

export interface AlertRecord {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  kind: string;
  file_ref: string | null;
  message: string;
  created_at: string;
  acknowledged: number;
}

export interface ScheduleRecord {
  id: number;
  file_id: string | null;
  interval_minutes: number;
  last_run: string | null;
  enabled: number;
}

export interface BenchmarkReport {
  telemetry: {
    platform: string;
    processor: string;
    architecture: string;
    python_version: string;
    cpu_count: number;
  };
  size_benchmarks: Array<{
    file_size_mb: number;
    block_count: number;
    sampled_blocks_c: number;
    sha256_ms_mean: number;
    full_chain_ms_mean: number;
    spotcheck_ms_mean: number;
  }>;
  version_benchmarks: Array<{
    version_count: number;
    verification_time_ms: number;
  }>;
  update_benchmarks: {
    file_size_mb: number;
    full_rebuild_ms: number;
    full_bytes_touched: number;
    dynamic_update_ms: number;
    dynamic_bytes_touched: number;
    speedup_ratio: number;
  };
  detection_benchmarks: Array<{
    corruption_rate: string;
    corrupted_blocks_k: number;
    sample_size_c: number;
    theoretical_prob: number;
    empirical_prob: number;
  }>;
  generated_at: string;
}
