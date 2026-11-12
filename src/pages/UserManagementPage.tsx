import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { StaffUser, UserRole } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'Agent Dispatch' as UserRole,
    contractor_name: '',
    area: '',
    phone: '',
  });

  // Password Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser(createForm);
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'Agent Dispatch',
        contractor_name: '',
        area: '',
        phone: '',
      });
      await fetchUsers();
    } catch (err: any) {
      alert(`Error creating user: ${err.message}`);
    }
  };

  const handleToggleStatus = async (user: StaffUser) => {
    const nextStatus = !user.is_active;
    if (confirm(`Yakin ingin mengubah status akun ${user.username} menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}?`)) {
      try {
        await api.toggleUserStatus(user.id, nextStatus);
        await fetchUsers();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPassword) return;
    try {
      await api.resetUserPassword(resetTargetUser.id, newPassword);
      setShowResetModal(false);
      setNewPassword('');
      alert(`Password untuk ${resetTargetUser.username} berhasil di-reset.`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            Management User &amp; Hak Akses Staff
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dikelola Terpusat oleh Superadmin &bull; Kontrol Role-Based Access Control (RBAC)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            <span>Segarkan</span>
          </button>

          {currentUser?.role === 'Superadmin' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tambah Staff Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Staff User Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <span className="text-xs font-bold text-white">
            Total {filtered.length} Akun Staff Terdaftar
          </span>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari user, nama, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs table-compact whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Username</th>
                <th className="py-3 px-3">Nama Lengkap</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Contractor &amp; Area</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Terakhir Login</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-mono font-bold text-sky-400">@{u.username}</td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-white">{u.full_name}</p>
                    <p className="text-[10px] text-slate-400">{u.email}</p>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="role" status={u.role}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    {u.contractor_name ? (
                      <>
                        <span className="text-slate-300 font-medium">{u.contractor_name}</span>
                        <p className="text-[10px] text-sky-400">{u.area}</p>
                      </>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={currentUser?.role !== 'Superadmin'}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                        u.is_active
                          ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900'
                          : 'bg-rose-950/70 border-rose-500/40 text-rose-400 hover:bg-rose-900'
                      }`}
                    >
                      {u.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{u.is_active ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px]">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Belum pernah'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {currentUser?.role === 'Superadmin' && (
                      <button
                        onClick={() => {
                          setResetTargetUser(u);
                          setShowResetModal(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                        title="Reset Password Staff"
                      >
                        <Key className="w-3 h-3" />
                        <span>Reset Pass</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tambah Akun Staff Baru WebJaws"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
              <input
                type="text"
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="e.g. teknisi.doni"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Internal</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="e.g. doni@webjaws.internal"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                placeholder="e.g. Doni Septiawan"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Password Awal</label>
              <input
                type="password"
                required
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Min 8 karakter"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Pilih Role</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            >
              <option value="Agent Dispatch">Agent Dispatch</option>
              <option value="Leader">Leader</option>
              <option value="Installer">Installer</option>
              <option value="Monitoring Data">Monitoring Data</option>
              <option value="IT Support Application">IT Support Application</option>
              <option value="Superadmin">Superadmin</option>
            </select>
          </div>

          {(createForm.role === 'Leader' || createForm.role === 'Installer') && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Contractor Name</label>
                <input
                  type="text"
                  value={createForm.contractor_name}
                  onChange={(e) => setCreateForm({ ...createForm, contractor_name: e.target.value })}
                  placeholder="e.g. PT Fiber Optik Nusantara"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Area Penugasan</label>
                <input
                  type="text"
                  value={createForm.area}
                  onChange={(e) => setCreateForm({ ...createForm, area: e.target.value })}
                  placeholder="e.g. Jakarta Selatan"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 cursor-pointer"
            >
              Simpan Akun Staff
            </button>
          </div>
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title={`Reset Password Staff: @${resetTargetUser?.username}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Password Baru</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Masukkan password baru minimal 8 karakter"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
            >
              Reset &amp; Cabut Sesi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
