import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, LockKeyhole, RefreshCw, XCircle } from 'lucide-react';
import { api } from '../../api/client';

type HealthSnapshot = {
  success: boolean;
  status: string;
  database: { connected: boolean; type?: string; latencyMs?: number; error?: string };
};

type FeatureState = 'verified' | 'pending' | 'locked' | 'offline';

const stateMeta: Record<FeatureState, { label: string; className: string; Icon: React.ElementType }> = {
  verified: { label: 'VERIFIED', className: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40', Icon: CheckCircle2 },
  pending: { label: 'PENDING', className: 'text-sky-300 bg-sky-950/60 border-sky-500/40', Icon: RefreshCw },
  locked: { label: 'LOCKED', className: 'text-amber-300 bg-amber-950/60 border-amber-500/40', Icon: LockKeyhole },
  offline: { label: 'OFFLINE', className: 'text-rose-300 bg-rose-950/60 border-rose-500/40', Icon: XCircle },
};

export const FeatureLockIndicator: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      const result = await api.getHealth();
      setHealth(result as HealthSnapshot);
      setLastChecked(new Date());
    } catch {
      setHealth(null);
      setLastChecked(new Date());
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const dbConnected = health?.database?.connected === true;
  const items = useMemo(() => [
    {
      name: 'Database connection',
      state: health === null ? 'offline' as FeatureState : dbConnected ? 'verified' as FeatureState : 'offline' as FeatureState,
      detail: health === null ? 'Health endpoint tidak dapat dihubungi.' : dbConnected ? `PostgreSQL terhubung${health.database.latencyMs != null ? ` · ${health.database.latencyMs} ms` : ''}. Ini hanya memverifikasi koneksi, bukan seluruh operasi CRUD.` : 'PostgreSQL tidak terhubung. Operasi database belum dapat dianggap aman.',
    },
    {
      name: 'Custom Authentication',
      state: 'pending' as FeatureState,
      detail: 'Implementasi cookie/session ada di backend. Login dan siklus session perlu diuji ulang pada environment aktif sebelum dinyatakan verified.',
    },
    {
      name: 'Work Orders persistence',
      state: 'locked' as FeatureState,
      detail: 'Penyimpanan Work Orders masih menggunakan webJawsStore di memori pada jalur yang diaudit. Jangan anggap data operasional tersimpan permanen.',
    },
    {
      name: 'Role authorization (RBAC)',
      state: 'pending' as FeatureState,
      detail: 'Middleware role tersedia. Pengujian akses seluruh role pada environment aktif masih diperlukan.',
    },
    {
      name: 'Row Level Security (RLS)',
      state: 'locked' as FeatureState,
      detail: 'Policy RLS dan trusted per-request database context belum diintegrasikan. RLS tidak diaktifkan oleh patch indikator ini.',
    },
  ], [health, dbConnected]);

  const hasAttention = items.some((item) => item.state !== 'verified');
  const overall = health === null ? 'offline' : !dbConnected ? 'offline' : hasAttention ? 'locked' : 'verified';
  const overallMeta = stateMeta[overall];
  const OverallIcon = overallMeta.Icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Lihat status kesiapan fitur WebJaws"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition hover:brightness-110 ${overallMeta.className}`}
        title="Status kesiapan fitur dan sinkronisasi database"
      >
        <OverallIcon className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">FEATURE STATUS</span>
        <span className="hidden sm:inline">{overallMeta.label}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 z-[70] mt-2 w-[min(92vw,390px)] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-white">WebJaws Feature Readiness</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Status konservatif · bukan pengganti integration test</p>
            </div>
            <button type="button" onClick={() => void check()} disabled={checking} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50" title="Periksa ulang koneksi database">
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
            {items.map((item) => {
              const meta = stateMeta[item.state];
              const Icon = meta.Icon;
              return (
                <div key={item.name} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                      <Icon className="h-4 w-4 shrink-0" />{item.name}
                    </div>
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${meta.className}`}>{meta.label}</span>
                  </div>
                  <p className="mt-1.5 pl-6 text-[10px] leading-relaxed text-slate-400">{item.detail}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-800 px-3.5 py-2.5">
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
              LOCKED/PENDING adalah peringatan kesiapan, bukan pemblokiran fitur atau pengganti otorisasi backend. Status VERIFIED hanya diberikan pada pemeriksaan yang benar-benar terukur.
            </p>
            <p className="mt-1 text-[9px] text-slate-600">{lastChecked ? `Pemeriksaan terakhir: ${lastChecked.toLocaleTimeString()}` : 'Belum ada hasil pemeriksaan.'}</p>
          </div>
        </div>
      )}
    </div>
  );
};
