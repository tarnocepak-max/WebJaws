import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Server,
  Lock,
  Layers,
  FileCode,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { DBStatus } from '../types';

export const DatabaseAppPage: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getHealth();
      setDbStatus(res.database);
    } catch (err) {
      console.error('Failed to check health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRunMigration = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await api.runMigration();
      setMigrationResult(res.result);
      await fetchStatus();
    } catch (err: any) {
      alert(`Migration error: ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-sky-400" />
            Database Application &amp; Supabase PostgreSQL
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manajemen Koneksi PostgreSQL, Eksekusi Migration DDL, Status Latensi &amp; Keamanan
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Uji Koneksi Ulang</span>
        </button>
      </div>

      {/* Connection Status Card */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          dbStatus?.connected
            ? 'bg-emerald-950/20 border-emerald-500/40'
            : 'bg-amber-950/20 border-amber-500/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl border ${
                dbStatus?.connected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Server className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {dbStatus?.connected
                    ? 'Koneksi Supabase PostgreSQL: AKTIF & TERHUBUNG'
                    : 'Penyimpanan Aktif: Local Standalone Store (Siap Koneksi Supabase)'}
                </h2>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    dbStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </div>

              <p className="text-xs text-slate-300 mt-1">
                {dbStatus?.connected
                  ? `Terhubung ke database '${dbStatus.databaseName}' dengan latensi respons ${dbStatus.latencyMs}ms.`
                  : dbStatus?.error || 'DATABASE_URL belum dikonfigurasi. WebJaws berjalan dalam mode memori sinkron.'}
              </p>

              <p className="text-[11px] font-mono text-slate-400 mt-2">
                Connection URI:{' '}
                <span className="text-sky-300">{dbStatus?.connectionStringMasked || 'Not Configured'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleRunMigration}
            disabled={migrating}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 disabled:opacity-50 transition cursor-pointer self-start sm:self-center"
          >
            {migrating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menjalankan DDL SQL...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Jalankan Migration SQL Schema</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Migration Execution Results if run */}
      {migrationResult && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-emerald-400" />
              Hasil Eksekusi Migration SQL 001_initial_schema.sql
            </h3>
            <span className="text-xs font-mono text-sky-400 font-bold">{migrationResult.durationMs}ms</span>
          </div>

          <p className="text-xs text-slate-300">{migrationResult.message}</p>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Tabel PostgreSQL yang Terverifikasi ({migrationResult.tablesCreated?.length || 0} Tabel):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {migrationResult.tablesCreated?.map((table: string) => (
                <span
                  key={table}
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-800 font-medium"
                >
                  {table}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Technical Database Documentation Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Supabase Connection Setup */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-sky-400" />
            1. Format Koneksi Supabase PostgreSQL
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Untuk menghubungkan WebJaws ke project Supabase Anda, masukkan connection string pada file environment:
          </p>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-sky-300 overflow-x-auto">
            DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
          </div>

          <div className="text-[11px] text-slate-400 space-y-1">
            <p>&bull; Port 6543 menggunakan Supabase Connection Pooling (Transaction Mode).</p>
            <p>&bull; Port 5432 menggunakan direct connection.</p>
            <p>&bull; Menggunakan SSL mode require untuk enkripsi in-transit.</p>
          </div>
        </div>

        {/* Security & Backup Strategy */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            2. Keamanan &amp; Backup Strategy
          </h3>

          <div className="text-xs text-slate-300 space-y-2">
            <p>
              <strong className="text-white">Custom Authentication:</strong> WebJaws tidak menggunakan Supabase Auth. Kredensial staf dikelola dalam tabel <code className="text-sky-300 font-mono">staff_users</code> dengan enkripsi password hashing dan verifikasi server-side.
            </p>
            <p>
              <strong className="text-white">Audit Logging:</strong> Setiap operasi migrasi, login, logout, perubahan konfigurasi, dan import WO dicatat secara permanen di tabel <code className="text-sky-300 font-mono">audit_logs</code>.
            </p>
            <p>
              <strong className="text-white">Backup &amp; Rollback:</strong> Database mendukung automated daily PITR (Point-in-Time Recovery) melalui Supabase dan sistem versioning konfigurasi aplikasi terpusat Superadmin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
