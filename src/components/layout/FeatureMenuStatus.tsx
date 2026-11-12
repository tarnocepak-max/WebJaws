import React from 'react';
import { CheckCircle2, LockKeyhole, RefreshCw, XCircle } from 'lucide-react';

export type MenuFeatureState = 'verified' | 'pending' | 'locked' | 'offline';

const stateConfig: Record<MenuFeatureState, { label: string; Icon: React.ElementType; className: string }> = {
  verified: { label: 'Verified', Icon: CheckCircle2, className: 'text-emerald-400' },
  pending: { label: 'Belum diverifikasi', Icon: RefreshCw, className: 'text-sky-400' },
  locked: { label: 'Belum siap / belum persisten', Icon: LockKeyhole, className: 'text-amber-400' },
  offline: { label: 'Database / layanan offline', Icon: XCircle, className: 'text-rose-400' },
};

/**
 * Conservative, code-audit-based menu status. This is an informational indicator,
 * not an authorization mechanism. Unknown routes remain pending until verified.
 */
export function getMenuFeatureState(path: string): MenuFeatureState {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';

  if (normalized.startsWith('/management-wo') || normalized.startsWith('/installer')) return 'locked';
  if (normalized === '/setup/database-application') return 'locked';
  if (normalized === '/management-user') return 'pending';
  if (normalized === '/dashboard' || normalized === '/contact-center' || normalized === '/report-wo') return 'pending';
  if (normalized.startsWith('/setup/')) return 'pending';

  return 'pending';
}

interface FeatureMenuStatusProps {
  path: string;
  compact?: boolean;
}

export const FeatureMenuStatus: React.FC<FeatureMenuStatusProps> = ({ path, compact = false }) => {
  const state = getMenuFeatureState(path);
  const config = stateConfig[state];
  const Icon = config.Icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center ${compact ? 'ml-1' : 'ml-2'} ${config.className}`}
      title={`Status fitur: ${config.label}. Indikator ini tidak mengubah hak akses.`}
      aria-label={`Status fitur: ${config.label}`}
      role="img"
    >
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {!compact && <span className="sr-only">{config.label}</span>}
    </span>
  );
};
