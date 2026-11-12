import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Key,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  Filter,
  Check,
  Phone,
  Mail,
  Building,
  MapPin,
  Clock,
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
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [availableRoles, setAvailableRoles] = useState<string[]>([
    'Superadmin',
    'Agent Dispatch',
    'Leader',
    'Installer',
    'Monitoring Data',
    'IT Support Application',
  ]);

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

  // Edit User Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTargetUser, setEditTargetUser] = useState<StaffUser | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: 'Agent Dispatch' as UserRole,
    contractor_name: '',
    area: '',
    phone: '',
    password: '',
  });

  // Password Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // User Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailUser, setDetailUser] = useState<StaffUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUsers();
      setUsers(res.users || []);
    } catch (err: any) {
      console.error('Failed to load users from PostgreSQL:', err);
      setError(err.message || 'Gagal memuat daftar staff dari database PostgreSQL');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.getRoles();
      if (res.roles && res.roles.length > 0) {
        setAvailableRoles(res.roles.map((r) => r.id));
      }
    } catch {
      // Keep standard roles if roles endpoint is unavailable
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  // Dismiss notifications after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.createUser(createForm);
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
      setSuccess(res.message || `Akun staff '${createForm.username}' berhasil ditambahkan ke PostgreSQL`);
      await fetchUsers();
    } catch (err: any) {
      setError(`Gagal membuat akun: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (u: StaffUser) => {
    setEditTargetUser(u);
    setEditForm({
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      contractor_name: u.contractor_name || '',
      area: u.area || '',
      phone: u.phone || '',
      password: '',
    });
    setShowEditModal(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: any = {
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
        contractor_name: editForm.contractor_name,
        area: editForm.area,
        phone: editForm.phone,
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      const res = await api.updateUser(editTargetUser.id, payload);
      setShowEditModal(false);
      setSuccess(res.message || `Data staff '${editTargetUser.username}' berhasil diperbarui di PostgreSQL`);
      await fetchUsers();
    } catch (err: any) {
      setError(`Gagal memperbarui akun: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: StaffUser) => {
    const nextStatus = !user.is_active;
    const confirmMessage = nextStatus
      ? `Aktifkan akun staff @${user.username}? Pengguna akan diizinkan login kembali.`
      : `Nonaktifkan akun staff @${user.username}? Semua session aktifnya di PostgreSQL akan langsung dicabut seketika.`;

    if (window.confirm(confirmMessage)) {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await api.toggleUserStatus(user.id, nextStatus);
        setSuccess(res.message || `Status akun @${user.username} diubah menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}`);
        await fetchUsers();
      } catch (err: any) {
        setError(`Gagal mengubah status akun: ${err.message}`);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleDeleteUser = async (user: StaffUser) => {
    if (window.confirm(`PERINGATAN: Yakin ingin menghapus permanen akun staff @${user.username} (${user.full_name}) dari database?`)) {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await api.deleteUser(user.id);
        setSuccess(res.message || `Akun staff @${user.username} berhasil dihapus dari PostgreSQL`);
        await fetchUsers();
      } catch (err: any) {
        setError(`Gagal menghapus staff: ${err.message}`);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPassword) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.resetUserPassword(resetTargetUser.id, newPassword);
      setShowResetModal(false);
      setNewPassword('');
      setSuccess(res.message || `Password untuk @${resetTargetUser.username} berhasil di-reset dan session lamanya dicabut.`);
    } catch (err: any) {
      setError(`Gagal reset password: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDetail = async (u: StaffUser) => {
    try {
      const res = await api.getUserById(u.id);
      setDetailUser(res.user);
      setShowDetailModal(true);
    } catch {
      setDetailUser(u);
      setShowDetailModal(true);
    }
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && !u.is_active) return false;
    if (statusFilter === 'inactive' && u.is_active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      u.username.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.contractor_name && u.contractor_name.toLowerCase().includes(q)) ||
      (u.area && u.area.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q))
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
            Terintegrasi PostgreSQL &bull; Single Source of Truth &bull; Role-Based Access Control (RBAC)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
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

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold text-xs">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-start justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white font-bold text-xs">
            &times;
          </button>
        </div>
      )}

      {/* Staff User Table & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">
              Total {filtered.length} Akun Staff Terdaftar
            </span>
            {loading && <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Role */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">Semua Role</option>
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari user, nama, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs table-compact whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Username</th>
                <th className="py-3 px-3">Nama Lengkap &amp; Kontak</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Contractor &amp; Area</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Terakhir Login</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 text-sky-400 animate-spin mx-auto mb-2" />
                    <span>Memuat data pengguna dari PostgreSQL...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">Tidak ada staff yang cocok dengan filter</p>
                    <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter role/status</p>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">
                      <button
                        onClick={() => handleOpenDetail(u)}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                        title="Lihat detail lengkap"
                      >
                        @{u.username}
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-white">{u.full_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{u.email}</span>
                        {u.phone && <span>&bull; {u.phone}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="role" status={u.role}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      {u.contractor_name || u.area ? (
                        <>
                          <span className="text-slate-300 font-medium">{u.contractor_name || '-'}</span>
                          {u.area && <p className="text-[10px] text-sky-400">{u.area}</p>}
                        </>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={currentUser?.role !== 'Superadmin' || actionLoading}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer disabled:cursor-not-allowed ${
                          u.is_active
                            ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900'
                            : 'bg-rose-950/70 border-rose-500/40 text-rose-400 hover:bg-rose-900'
                        }`}
                        title={
                          currentUser?.role === 'Superadmin'
                            ? `Klik untuk ${u.is_active ? 'nonaktifkan' : 'aktifkan'} akun`
                            : 'Hanya Superadmin yang dapat mengubah status'
                        }
                      >
                        {u.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{u.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Belum pernah'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleOpenDetail(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Detail Pengguna"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {currentUser?.role === 'Superadmin' && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-900/60 text-slate-300 hover:text-sky-300 transition cursor-pointer"
                              title="Edit Data Staff & Role"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setResetTargetUser(u);
                                setShowResetModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-900/60 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                              title="Reset Password Staff"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                title="Hapus Staff"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tambah Akun Staff Baru WebJaws (PostgreSQL)"
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
              <label className="block text-xs font-bold text-slate-300 mb-1">Password Awal (min 8 char)</label>
              <input
                type="password"
                required
                minLength={8}
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Minimal 8 karakter"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Pilih Role</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nomor Telepon (Opsional)</label>
              <input
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="e.g. 081234567890"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Contractor Name (Opsional)</label>
              <input
                type="text"
                value={createForm.contractor_name}
                onChange={(e) => setCreateForm({ ...createForm, contractor_name: e.target.value })}
                placeholder="e.g. PT Fiber Optik Nusantara"
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Area Penugasan (Opsional)</label>
              <input
                type="text"
                value={createForm.area}
                onChange={(e) => setCreateForm({ ...createForm, area: e.target.value })}
                placeholder="e.g. Jakarta Selatan"
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan ke Database</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT STAFF MODAL */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Staff: @${editTargetUser?.username}`}
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Role Staff</label>
              <select
                value={editForm.role}
                disabled={editTargetUser?.id === currentUser?.id}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {editTargetUser?.id === currentUser?.id && (
                <p className="text-[10px] text-amber-400 mt-1">Anda tidak dapat mengubah role akun Anda sendiri.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nomor Telepon</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="e.g. 081234567890"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Contractor Name</label>
              <input
                type="text"
                value={editForm.contractor_name}
                onChange={(e) => setEditForm({ ...editForm, contractor_name: e.target.value })}
                placeholder="Nama kontraktor"
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Area Penugasan</label>
              <input
                type="text"
                value={editForm.area}
                onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                placeholder="Area penugasan"
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Ganti Password (Opsional)
            </label>
            <input
              type="password"
              minLength={8}
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="Biarkan kosong jika tidak ingin mengubah password"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Jika password baru diisi (min 8 karakter), seluruh session lama pengguna akan dicabut seketika.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan Perubahan</span>
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
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Masukkan password baru minimal 8 karakter"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Tindakan ini akan meng-hash password dengan bcrypt dan mencabut semua session aktif staff di PostgreSQL.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Reset &amp; Cabut Sesi</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* USER DETAIL MODAL */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Detail Staff: @${detailUser?.username}`}
      >
        {detailUser && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center font-bold text-base">
                {detailUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-white text-sm">{detailUser.full_name}</p>
                <p className="text-slate-400 font-mono">@{detailUser.username}</p>
              </div>
              <div className="ml-auto">
                <Badge variant="role" status={detailUser.role}>
                  {detailUser.role}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Email</span>
                </div>
                <p className="font-semibold text-white break-all">{detailUser.email}</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Telepon</span>
                </div>
                <p className="font-semibold text-white">{detailUser.phone || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>Contractor</span>
                </div>
                <p className="font-semibold text-white">{detailUser.contractor_name || '-'}</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Area Penugasan</span>
                </div>
                <p className="font-semibold text-white">{detailUser.area || '-'}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status Akun:</span>
                <span className={detailUser.is_active ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {detailUser.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Terakhir Login:
                </span>
                <span className="text-slate-200">
                  {detailUser.last_login_at ? new Date(detailUser.last_login_at).toLocaleString() : 'Belum pernah'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Dibuat pada:</span>
                <span className="text-slate-200">
                  {detailUser.created_at ? new Date(detailUser.created_at).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>ID Internal (UUID):</span>
                <span className="font-mono text-[10px] text-slate-300">{detailUser.id}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
