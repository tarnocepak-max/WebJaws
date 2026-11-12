import React, { useEffect, useState } from 'react';
import { ShieldCheck, User, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

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

  useEffect(() => {
    fetch('/api/setup/status', { credentials: 'include' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Setup status unavailable'); setAvailable(Boolean(d.available)); })
      .catch(e => setError(e.message));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password !== confirmPassword) return setError('Konfirmasi password tidak sama.');
    setLoading(true);
    try {
      const response = await fetch('/api/setup/superadmin', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, email, password, setupToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Setup gagal');
      setAvailable(false);
      onComplete();
    } catch (e: any) { setError(e.message || 'Setup gagal'); }
    finally { setLoading(false); }
  };

  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
    <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center"><ShieldCheck /></div>
        <div><h1 className="text-xl font-bold">WebJaws First-Time Setup</h1><p className="text-xs text-slate-400">Buat akun Superadmin pertama</p></div>
      </div>
      {available === null && !error && <p className="text-sm text-slate-300">Memeriksa status setup...</p>}
      {available === false && <div className="rounded-xl bg-emerald-950/50 border border-emerald-800 p-4 text-emerald-300 flex gap-2"><CheckCircle2 /> Setup awal sudah ditutup. Silakan login.</div>}
      {available === true && <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-300">Akun pertama akan memperoleh role Superadmin. Setup hanya dapat berhasil satu kali.</p>
        {[
          { label: 'Nama lengkap', value: fullName, set: setFullName, type: 'text', icon: User },
          { label: 'Username', value: username, set: setUsername, type: 'text', icon: User },
          { label: 'Email', value: email, set: setEmail, type: 'email', icon: Mail },
          { label: 'Setup authorization token', value: setupToken, set: setSetupToken, type: 'password', icon: Lock },
          { label: 'Password (minimal 12 karakter)', value: password, set: setPassword, type: 'password', icon: Lock },
          { label: 'Konfirmasi password', value: confirmPassword, set: setConfirmPassword, type: 'password', icon: Lock },
        ].map(({label,value,set,type,icon: Icon}) => <label key={label} className="block">
          <span className="block text-xs font-semibold text-slate-300 mb-1.5">{label}</span>
          <span className="relative block"><Icon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input required type={type} value={value} onChange={e => set(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
          </span>
        </label>)}
        {error && <div className="text-sm text-rose-300 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <button disabled={loading} className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 py-3 font-bold text-sm">{loading ? 'Membuat akun...' : 'Buat Akun Superadmin'}</button>
      </form>}
      {available === null && error && <p className="text-sm text-rose-300">{error}</p>}
      <p className="mt-5 text-[11px] text-slate-500">Pastikan aplikasi menggunakan HTTPS sebelum membuat akun produksi.</p>
    </div>
  </div>;
};
