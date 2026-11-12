import React, { useEffect, useState } from 'react';
import { ShieldCheck, User, Mail, Lock, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';

type Props = { onComplete: () => void };

export const FirstSuperadminSetupPage: React.FC<Props> = ({ onComplete }) => {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusChecking, setStatusChecking] = useState(true);

  const checkStatus = () => {
    setStatusChecking(true);
    setError('');
    fetch('/api/setup/status', { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal memeriksa status setup dari database');
        setAvailable(Boolean(d.available));
      })
      .catch((e) => {
        setError(e.message);
        setAvailable(null);
      })
      .finally(() => setStatusChecking(false));
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      return setError('Konfirmasi password tidak cocok dengan password.');
    }
    if (password.length < 12) {
      return setError('Password harus minimal 12 karakter.');
    }
    setLoading(true);
    try {
      const response = await fetch('/api/setup/superadmin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, email, password, setupToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Setup gagal');
      setAvailable(false);
      onComplete();
    } catch (e: any) {
      setError(e.message || 'Gagal membuat Superadmin pertama');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-5 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">WebJaws Initial Setup</h1>
              <p className="text-xs text-slate-400">Inisialisasi Superadmin Pertama (PostgreSQL)</p>
            </div>
          </div>

          <button
            onClick={onComplete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ke Login</span>
          </button>
        </div>

        {statusChecking && (
          <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
            <span>Memeriksa status akun Superadmin di PostgreSQL...</span>
          </div>
        )}

        {!statusChecking && available === false && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-950/60 border border-emerald-800 p-4 text-emerald-300 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-200">Setup Awal Sudah Ditutup</p>
                <p className="mt-1 text-slate-300">
                  Akun Superadmin sudah terdaftar di database PostgreSQL. Untuk alasan keamanan, mekanisme initial setup telah dikunci permanen.
                </p>
              </div>
            </div>
            <button
              onClick={onComplete}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer"
            >
              Masuk ke Halaman Login
            </button>
          </div>
        )}

        {!statusChecking && available === true && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              Akun pertama yang dibuat akan memperoleh role <strong className="text-sky-400">Superadmin</strong> dengan akses penuh. Memerlukan setup token rahasia dari environment variable <code className="text-sky-300 font-mono text-[11px]">WEBJAWS_SETUP_TOKEN</code>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Master Administrator"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. superadmin"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Internal</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@webjaws.internal"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Setup Authorization Token</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="password"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  placeholder="Nilai dari WEBJAWS_SETUP_TOKEN di environment"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password (min 12 char)</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="password"
                    minLength={12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 12 karakter"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Konfirmasi Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="password"
                    minLength={12}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 py-2.5 font-bold text-xs shadow-lg shadow-sky-600/30 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Memproses Transaksi...' : 'Buat Akun Superadmin di PostgreSQL'}</span>
            </button>
          </form>
        )}

        {!statusChecking && available === null && error && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={checkStatus}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold transition cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>Protokol Keamanan: bcrypt cost 12 &bull; Advisory Lock</span>
          <span>WebJaws v1.0</span>
        </div>
      </div>
    </div>
  );
};
