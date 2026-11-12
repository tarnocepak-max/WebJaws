import React, { useState, useEffect } from 'react';
import {
  Sliders,
  History,
  RotateCcw,
  Save,
  CheckCircle2,
  Palette,
  Shield,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { AppConfig } from '../types';

export const AppSettingPage: React.FC = () => {
  const { appConfig, refreshConfig } = useAuth();
  const [configForm, setConfigForm] = useState<AppConfig | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [changeSummary, setChangeSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (appConfig) {
      setConfigForm(JSON.parse(JSON.stringify(appConfig)));
    }
  }, [appConfig]);

  const fetchVersions = async () => {
    try {
      const res = await api.getConfigVersions();
      setVersions(res.versions || []);
    } catch (err) {
      console.error('Failed to load version history:', err);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm) return;

    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await api.saveConfig(
        configForm,
        changeSummary || 'Pembaruan konfigurasi global oleh Superadmin'
      );
      setStatusMsg(`Konfigurasi v${res.config.version} berhasil diterapkan ke seluruh staff.`);
      setChangeSummary('');
      await refreshConfig();
      await fetchVersions();
    } catch (err: any) {
      alert(`Error saving config: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    if (confirm(`Kembalikan konfigurasi aplikasi ke Versi ${versionNumber}?`)) {
      try {
        const res = await api.rollbackConfig(versionNumber);
        setStatusMsg(res.message);
        await refreshConfig();
        await fetchVersions();
      } catch (err: any) {
        alert(`Error during rollback: ${err.message}`);
      }
    }
  };

  if (!configForm) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-sky-400" />
            Setting Aplikasi &amp; Konfigurasi Terpusat Superadmin
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Versi Aktif: <span className="text-sky-400 font-bold font-mono">v{configForm.version}</span> &bull; Seluruh perubahan langsung diterapkan ke staff secara real-time
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveConfig} className="space-y-6">
        {/* Section 1: UI & Tampilan Global */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Palette className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              1. Tampilan, Tema &amp; Banner Header
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nama Aplikasi</label>
              <input
                type="text"
                value={configForm.appName}
                onChange={(e) => setConfigForm({ ...configForm, appName: e.target.value })}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Judul Operasional Platform</label>
              <input
                type="text"
                value={configForm.appTitle}
                onChange={(e) => setConfigForm({ ...configForm, appTitle: e.target.value })}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">Teks Banner Topbar</label>
              <input
                type="text"
                value={configForm.theme.headerBanner}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    theme: { ...configForm.theme, headerBanner: e.target.value },
                  })
                }
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Workflow Rules */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              2. Pengaturan Aturan Workflow Operasional
            </h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={configForm.workflow.installerDoneRequiresDispatchApproval}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    workflow: {
                      ...configForm.workflow,
                      installerDoneRequiresDispatchApproval: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 rounded text-sky-600 focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  Status 'Done' Installer Memerlukan Verifikasi &amp; Approval Agent Dispatch
                </span>
                <span className="text-[11px] text-slate-400">
                  Mencegah tiket otomatis Complete hanya karena Installer memilih Done. Sesuai Section J.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={configForm.workflow.preventDuplicateWoNumber}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    workflow: {
                      ...configForm.workflow,
                      preventDuplicateWoNumber: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 rounded text-sky-600 focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  Cegah Duplikasi WO Number Saat Import
                </span>
                <span className="text-[11px] text-slate-400">
                  WO Number unik wajib ditegakkan untuk menjaga integritas riwayat dan audit trail.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 3: WhatsApp Notification Template */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              3. Template Pesan Konfirmasi WhatsApp Teknisi
            </h2>
          </div>

          <div>
            <textarea
              rows={3}
              value={configForm.whatsappTemplate}
              onChange={(e) => setConfigForm({ ...configForm, whatsappTemplate: e.target.value })}
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-sans focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Variabel yang didukung: <code className="text-sky-400">&#123;&#123;customer_name&#125;&#125;</code>,{' '}
              <code className="text-sky-400">&#123;&#123;wo_number&#125;&#125;</code>,{' '}
              <code className="text-sky-400">&#123;&#123;installer_name&#125;&#125;</code>,{' '}
              <code className="text-sky-400">&#123;&#123;street_name&#125;&#125;</code>,{' '}
              <code className="text-sky-400">&#123;&#123;slot_time&#125;&#125;</code>
            </p>
          </div>
        </div>

        {/* Save Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Tulis ringkasan perubahan konfigurasi..."
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menerapkan Versi Baru...' : 'Simpan & Publikasikan Versi Baru'}</span>
          </button>
        </div>
      </form>

      {/* Section 4: Version History & Rollback (Section F requirement) */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <History className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            4. Riwayat Versi &amp; Mekanisme Rollback Konfigurasi
          </h2>
        </div>

        <div className="space-y-2">
          {versions.map((ver) => (
            <div
              key={ver.version_id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sky-400 text-sm">v{ver.version_number}</span>
                  <span className="font-semibold text-white">{ver.title}</span>
                  <span className="text-[10px] text-slate-400">&bull; Oleh: {ver.created_by_name}</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-0.5">{ver.change_summary}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(ver.created_at).toLocaleString()}</p>
              </div>

              {ver.version_number !== configForm.version && (
                <button
                  type="button"
                  onClick={() => handleRollback(ver.version_number)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rollback ke v{ver.version_number}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
