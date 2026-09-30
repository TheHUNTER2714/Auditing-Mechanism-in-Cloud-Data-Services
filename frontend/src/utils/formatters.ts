export function shortHash(hash: string | undefined | null, chars: number = 8): string {
  if (!hash) return '--------';
  if (hash.length <= chars * 2) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

export function getStatusTheme(status: string | undefined | null): {
  label: string;
  bg: string;
  text: string;
  border: string;
  glow: string;
} {
  switch (status) {
    case 'PASS':
      return {
        label: 'INTEGRITY VERIFIED',
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
      };
    case 'RECORDED_VERSION':
      return {
        label: 'VERSION RECORDED',
        bg: 'bg-cyan-950/40',
        text: 'text-cyan-400',
        border: 'border-cyan-500/40',
        glow: 'shadow-[0_0_15px_rgba(34,211,238,0.2)]',
      };
    case 'TAMPERED':
      return {
        label: 'CORRUPTION DETECTED',
        bg: 'bg-red-950/50',
        text: 'text-red-400',
        border: 'border-red-500/50',
        glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      };
    case 'VERSION_HISTORY_ALTERED':
      return {
        label: 'CHAIN ALTERED',
        bg: 'bg-amber-950/50',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
        glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      };
    default:
      return {
        label: status || 'UNKNOWN',
        bg: 'bg-slate-900/50',
        text: 'text-slate-300',
        border: 'border-slate-700/50',
        glow: '',
      };
  }
}
