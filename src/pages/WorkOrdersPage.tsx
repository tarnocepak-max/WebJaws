import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Search,
  Filter,
  Eye,
  UserCheck,
  CheckCircle2,
  Clock,
  Calendar,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { WorkOrder } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface WorkOrdersPageProps {
  pageType: 'total' | 'complete' | 'pending' | 'reschedule' | 'contractor' | 'archive' | 'distribute';
  title: string;
}

export const WorkOrdersPage: React.FC<WorkOrdersPageProps> = ({ pageType, title }) => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    installer_name: '',
    slot_time: '10:00 - 12:00',
  });

  const fetchWos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getWorkOrders({ limit: '100' });
      let list = res.workOrders;

      if (pageType === 'complete') {
        list = list.filter((w) => w.system_status === 'Completed' || w.status_wo_agent === 'Approved');
      } else if (pageType === 'pending') {
        list = list.filter((w) => w.status_wo_agent === 'Pending' || w.status_wo_installer === 'Pending');
      } else if (pageType === 'reschedule') {
        list = list.filter((w) => w.status_wo_agent === 'Reschedule' || w.status_wo_installer === 'Reschedule');
      } else if (pageType === 'archive') {
        list = list.filter((w) => w.system_status === 'Archived' || w.system_status === 'Completed');
      } else if (pageType === 'distribute') {
        list = list.filter((w) => !w.installer_name || w.system_status === 'Requested' || w.system_status === 'Assigned');
      }

      setWorkOrders(list);
    } catch (err) {
      console.error('Failed to load WOs:', err);
    } finally {
      setLoading(false);
    }
  }, [pageType]);

  useEffect(() => {
    fetchWos();
  }, [fetchWos]);

  const handleOpenAssign = (wo: WorkOrder) => {
    setSelectedWo(wo);
    setAssignForm({
      installer_name: wo.installer_name || 'Budi Santoso (Installer)',
      slot_time: wo.slot_time || '10:00 - 12:00',
    });
    setShowAssignModal(true);
  };

  const handleSaveAssign = async () => {
    if (!selectedWo) return;
    try {
      await api.assignWO(selectedWo.id, assignForm);
      setShowAssignModal(false);
      await fetchWos();
    } catch (err: any) {
      alert(`Error assigning WO: ${err.message}`);
    }
  };

  const filtered = workOrders.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.wo_number.toLowerCase().includes(q) ||
      (w.customer_name && w.customer_name.toLowerCase().includes(q)) ||
      (w.contactor_name && w.contactor_name.toLowerCase().includes(q)) ||
      (w.area && w.area.toLowerCase().includes(q)) ||
      (w.installer_name && w.installer_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            {title}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Modul Manajemen Operasional &bull; Role Akses: {user?.role}
          </p>
        </div>

        <button
          onClick={fetchWos}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <span className="text-xs font-bold text-white">
            Total {filtered.length} Tiket Ditemukan
          </span>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari WO, Pelanggan, Teknisi..."
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
                <th className="py-3 px-3">WO Number</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Pelanggan</th>
                <th className="py-3 px-3">Contractor &amp; Area</th>
                <th className="py-3 px-3">Teknisi (Installer)</th>
                <th className="py-3 px-3">Slot Waktu</th>
                <th className="py-3 px-3">Status Agent</th>
                <th className="py-3 px-3">Status Installer</th>
                <th className="py-3 px-3">System Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filtered.length > 0 ? (
                filtered.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{wo.wo_number}</td>
                    <td className="py-3 px-3 text-slate-300">{wo.date}</td>
                    <td className="py-3 px-3 font-semibold text-white">{wo.customer_name}</td>
                    <td className="py-3 px-3">
                      <span>{wo.contactor_name}</span>
                      <p className="text-[10px] text-sky-400">{wo.area}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-200">
                      {wo.installer_name ? (
                        <span className="font-semibold text-white">{wo.installer_name}</span>
                      ) : (
                        <span className="text-amber-400 font-medium">Belum Ditugaskan</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{wo.slot_time || '-'}</td>
                    <td className="py-3 px-3">
                      <Badge variant="agent" status={wo.status_wo_agent} />
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="installer" status={wo.status_wo_installer} />
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="system" status={wo.system_status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedWo(wo)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {(user?.role === 'Superadmin' || user?.role === 'Agent Dispatch' || user?.role === 'Leader') && (
                          <button
                            onClick={() => handleOpenAssign(wo)}
                            className="p-1.5 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800/40 transition cursor-pointer"
                            title="Distribusi / Tugaskan Teknisi"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-300">Belum ada data untuk kategori ini</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedWo && !showAssignModal}
        onClose={() => setSelectedWo(null)}
        title={`Work Order: ${selectedWo?.wo_number}`}
        maxWidth="2xl"
      >
        {selectedWo && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-slate-400">Pelanggan:</span>
                <p className="font-bold text-white">{selectedWo.customer_name}</p>
                <p className="font-mono text-slate-400">{selectedWo.customer_phone}</p>
              </div>
              <div>
                <span className="text-slate-400">Contractor &amp; Area:</span>
                <p className="font-bold text-white">{selectedWo.contactor_name}</p>
                <p className="text-sky-400">{selectedWo.area}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Alamat Lengkap:</span>
              <p className="text-white mt-0.5">{selectedWo.street_name || '-'}</p>
              <p className="text-slate-400 text-[11px] mt-1">Cluster: {selectedWo.cluster_name || '-'}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">FAT Code</span>
                <span className="font-mono font-bold text-white">{selectedWo.fat_code || '-'}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">FDT Code</span>
                <span className="font-mono font-bold text-white">{selectedWo.fdt_code || '-'}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Slot Time</span>
                <span className="font-mono font-bold text-white">{selectedWo.slot_time || '-'}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Distribusi / Penugasan Teknisi: ${selectedWo?.wo_number}`}
        footer={
          <>
            <button
              onClick={() => setShowAssignModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
            >
              Batal
            </button>
            <button
              onClick={handleSaveAssign}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 cursor-pointer"
            >
              Simpan Penugasan
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Pilih Nama Teknisi (Installer)</label>
            <input
              type="text"
              value={assignForm.installer_name}
              onChange={(e) => setAssignForm({ ...assignForm, installer_name: e.target.value })}
              placeholder="e.g. Budi Santoso (Installer)"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Slot Waktu Pengerjaan</label>
            <select
              value={assignForm.slot_time}
              onChange={(e) => setAssignForm({ ...assignForm, slot_time: e.target.value })}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            >
              <option value="08:00 - 10:00">08:00 - 10:00</option>
              <option value="10:00 - 12:00">10:00 - 12:00</option>
              <option value="13:00 - 15:00">13:00 - 15:00</option>
              <option value="15:00 - 17:00">15:00 - 17:00</option>
              <option value="18:00 - 20:00">18:00 - 20:00</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
