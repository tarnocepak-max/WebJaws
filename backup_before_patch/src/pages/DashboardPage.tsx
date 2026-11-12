import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  Layers,
  XCircle,
  Clock,
  Calendar,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit3,
  MapPin,
  Building2,
  User,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { WorkOrder, AgentStatus, InstallerStatus } from '../types';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterCard, setActiveFilterCard] = useState<string | null>(null);

  // Selected WO for details modal
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null);
  const [woHistory, setWoHistory] = useState<any[]>([]);

  // Agent Status Modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusFormData, setStatusFormData] = useState({
    status_wo_agent: 'Approved',
    reason_wo_agent: '',
    rootcause_wo_agent: '',
    remarks_wo_agent: '',
    approve_complete: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statsRes = await api.getWOStats();
      setStats(statsRes.stats);

      const woRes = await api.getWorkOrders({ limit: '100' });
      setWorkOrders(woRes.workOrders);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCardClick = (filterType: string) => {
    if (activeFilterCard === filterType) {
      setActiveFilterCard(null); // toggle off
    } else {
      setActiveFilterCard(filterType);
    }
  };

  const handleViewDetail = async (wo: WorkOrder) => {
    try {
      const res = await api.getWODetail(wo.id);
      setSelectedWo(res.workOrder);
      setWoHistory(res.statusHistory || []);
    } catch (err) {
      setSelectedWo(wo);
      setWoHistory([]);
    }
  };

  const handleOpenStatusModal = (wo: WorkOrder) => {
    setSelectedWo(wo);
    setStatusFormData({
      status_wo_agent: wo.status_wo_agent || 'Approved',
      reason_wo_agent: wo.reason_wo_agent || '',
      rootcause_wo_agent: wo.rootcause_wo_agent || '',
      remarks_wo_agent: wo.remarks_wo_agent || '',
      approve_complete: false,
    });
    setShowStatusModal(true);
  };

  const handleSaveAgentStatus = async () => {
    if (!selectedWo) return;
    try {
      await api.updateAgentStatus(selectedWo.id, statusFormData);
      setShowStatusModal(false);
      await fetchData();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Filtered list based on search and active card filter
  let displayedWos = workOrders.filter((wo) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      wo.wo_number.toLowerCase().includes(q) ||
      (wo.customer_name && wo.customer_name.toLowerCase().includes(q)) ||
      (wo.contactor_name && wo.contactor_name.toLowerCase().includes(q)) ||
      (wo.area && wo.area.toLowerCase().includes(q)) ||
      (wo.fat_code && wo.fat_code.toLowerCase().includes(q))
    );
  });

  if (activeFilterCard) {
    switch (activeFilterCard) {
      case 'requested':
        displayedWos = displayedWos.filter((w) => w.system_status === 'Requested');
        break;
      case 'cancel':
        displayedWos = displayedWos.filter((w) => w.status_wo_agent === 'Cancel');
        break;
      case 'pending':
        displayedWos = displayedWos.filter((w) => w.status_wo_agent === 'Pending' || w.status_wo_installer === 'Pending');
        break;
      case 'reschedule':
        displayedWos = displayedWos.filter((w) => w.status_wo_agent === 'Reschedule' || w.status_wo_installer === 'Reschedule');
        break;
      case 'approved':
        displayedWos = displayedWos.filter((w) => w.status_wo_agent === 'Approved');
        break;
      case 'unhandled_agent':
        displayedWos = displayedWos.filter((w) => w.status_wo_agent === 'Unhandled');
        break;
      case 'unhandled_installer':
        displayedWos = displayedWos.filter((w) => w.status_wo_installer === 'Unhandled');
        break;
      default:
        break;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Dashboard Operasional
            {user?.contractor_name && (
              <span className="text-xs font-normal text-slate-400">({user.contractor_name} &bull; {user.area})</span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoring Real-time Distribusi Work Order &amp; Progres Pengerjaan Lapangan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            <span>Segarkan Data</span>
          </button>

          {(user?.role === 'Superadmin' || user?.role === 'Agent Dispatch') && (
            <button
              onClick={() => onNavigate('/management-wo/import-wo')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 cursor-pointer"
            >
              <span>+ Import WO Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* 8 CORE OPERATIONAL CARDS (Exact match to Section I) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. WO Requested */}
        <StatCard
          title="1. WO Requested"
          count={stats?.woRequested ?? 0}
          icon={Inbox}
          colorScheme="sky"
          isActive={activeFilterCard === 'requested'}
          onClick={() => handleCardClick('requested')}
          subtext="WO Baru Di-import"
        />

        {/* 2. Total WO */}
        <StatCard
          title="2. Total WO"
          count={stats?.totalWO ?? 0}
          icon={Layers}
          colorScheme="indigo"
          isActive={activeFilterCard === null}
          onClick={() => setActiveFilterCard(null)}
          subtext="Semua Tiket Aktif"
        />

        {/* 3. Cancel */}
        <StatCard
          title="3. Cancel"
          count={stats?.cancelCount ?? 0}
          icon={XCircle}
          colorScheme="rose"
          isActive={activeFilterCard === 'cancel'}
          onClick={() => handleCardClick('cancel')}
          subtext="Dibatalkan"
        />

        {/* 4. Pending */}
        <StatCard
          title="4. Pending"
          count={stats?.pendingCount ?? 0}
          icon={Clock}
          colorScheme="amber"
          isActive={activeFilterCard === 'pending'}
          onClick={() => handleCardClick('pending')}
          subtext="Tertunda Lapangan"
        />

        {/* 5. Reschedule */}
        <StatCard
          title="5. Reschedule"
          count={stats?.rescheduleCount ?? 0}
          icon={Calendar}
          colorScheme="purple"
          isActive={activeFilterCard === 'reschedule'}
          onClick={() => handleCardClick('reschedule')}
          subtext="Jadwal Ulang"
        />

        {/* 6. Approved Agent */}
        <StatCard
          title="6. Approved Agent"
          count={stats?.approvedAgent ?? 0}
          icon={CheckCircle}
          colorScheme="emerald"
          isActive={activeFilterCard === 'approved'}
          onClick={() => handleCardClick('approved')}
          subtext="Disetujui Dispatch"
        />

        {/* 7. Unhandled Agent */}
        <StatCard
          title="7. Unhandled Agent"
          count={stats?.unhandledAgent ?? 0}
          icon={HelpCircle}
          colorScheme="slate"
          isActive={activeFilterCard === 'unhandled_agent'}
          onClick={() => handleCardClick('unhandled_agent')}
          subtext="Belum Direview Agent"
        />

        {/* 8. Unhandled Installer */}
        <StatCard
          title="8. Unhandled Installer"
          count={stats?.unhandledInstaller ?? 0}
          icon={AlertTriangle}
          colorScheme="teal"
          isActive={activeFilterCard === 'unhandled_installer'}
          onClick={() => handleCardClick('unhandled_installer')}
          subtext="Belum Dikerjakan Teknisi"
        />
      </div>

      {/* ADDITIONAL MONITORING BREAKDOWN AREAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monitoring by Contractor */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-sky-400" />
              Monitoring by Contractor
            </h3>
            <span className="text-[10px] text-slate-400">Total Mitra</span>
          </div>
          <div className="space-y-2.5">
            {stats?.breakdown?.byContractor && Object.entries(stats.breakdown.byContractor).length > 0 ? (
              Object.entries(stats.breakdown.byContractor).map(([contractor, count]: [string, any]) => (
                <div key={contractor} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[200px]">{contractor}</span>
                    <span className="font-bold text-white">{count} WO</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / (stats.totalWO || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">Belum ada data contractor</p>
            )}
          </div>
        </div>

        {/* Monitoring by Area */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Monitoring by Area
            </h3>
            <span className="text-[10px] text-slate-400">Distribusi Wilayah</span>
          </div>
          <div className="space-y-2.5">
            {stats?.breakdown?.byArea && Object.entries(stats.breakdown.byArea).length > 0 ? (
              Object.entries(stats.breakdown.byArea).map(([area, count]: [string, any]) => (
                <div key={area} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[200px]">{area}</span>
                    <span className="font-bold text-white">{count} WO</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / (stats.totalWO || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">Belum ada data area</p>
            )}
          </div>
        </div>

        {/* Monitoring by Installer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-purple-400" />
              Monitoring by Installer
            </h3>
            <span className="text-[10px] text-slate-400">Teknisi Lapangan</span>
          </div>
          <div className="space-y-2.5">
            {stats?.breakdown?.byInstaller && Object.entries(stats.breakdown.byInstaller).length > 0 ? (
              Object.entries(stats.breakdown.byInstaller).map(([installer, count]: [string, any]) => (
                <div key={installer} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[200px]">{installer}</span>
                    <span className="font-bold text-white">{count} WO</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / (stats.totalWO || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">Belum ada data installer</p>
            )}
          </div>
        </div>
      </div>

      {/* WORK ORDER LIST TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">
              Daftar Work Order Operasional
            </h2>
            {activeFilterCard && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-1">
                Filter: {activeFilterCard}
                <button onClick={() => setActiveFilterCard(null)} className="hover:text-white font-bold ml-1">
                  &times;
                </button>
              </span>
            )}
            <span className="text-xs text-slate-400">({displayedWos.length} baris)</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari WO, Pelanggan, FAT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs table-compact">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">WO Number</th>
                <th className="py-3 px-3">Jadwal (Date)</th>
                <th className="py-3 px-3">Pelanggan</th>
                <th className="py-3 px-3">Contractor &amp; Area</th>
                <th className="py-3 px-3">Slot Time</th>
                <th className="py-3 px-3">Status Agent</th>
                <th className="py-3 px-3">Status Installer</th>
                <th className="py-3 px-3">System Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {displayedWos.length > 0 ? (
                displayedWos.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleViewDetail(wo)}
                        className="font-mono font-bold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {wo.wo_number}
                        <ArrowUpRight className="w-3 h-3 opacity-60" />
                      </button>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{wo.ticket_number || wo.id_customer || '-'}</p>
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      <span>{wo.date || '-'}</span>
                      <p className="text-[10px] text-slate-400">Up: {wo.date_upload ? wo.date_upload.split('T')[0] : '-'}</p>
                    </td>

                    <td className="py-3 px-3">
                      <p className="font-semibold text-white">{wo.customer_name || 'Tanpa Nama'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{wo.customer_phone || '-'}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{wo.street_name || '-'}</p>
                    </td>

                    <td className="py-3 px-3">
                      <p className="text-slate-200">{wo.contactor_name || '-'}</p>
                      <p className="text-[10px] text-sky-400">{wo.area || '-'}</p>
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      <span className="font-mono">{wo.slot_time || '-'}</span>
                      <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        Teknisi: {wo.installer_name || 'Unassigned'}
                      </p>
                    </td>

                    <td className="py-3 px-3">
                      <Badge variant="agent" status={wo.status_wo_agent}>
                        {wo.status_wo_agent}
                      </Badge>
                      {wo.reason_wo_agent && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5">{wo.reason_wo_agent}</p>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <Badge variant="installer" status={wo.status_wo_installer}>
                        {wo.status_wo_installer}
                      </Badge>
                      {wo.reason_wo_installer && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5">{wo.reason_wo_installer}</p>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <Badge variant="system" status={wo.system_status}>
                        {wo.system_status}
                      </Badge>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetail(wo)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Lihat Detail 44 Kolom"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {(user?.role === 'Superadmin' || user?.role === 'Agent Dispatch') && (
                          <button
                            onClick={() => handleOpenStatusModal(wo)}
                            className="p-1.5 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800/40 transition cursor-pointer"
                            title="Update Status Agent"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-300">Tidak ada Work Order yang sesuai</p>
                    <p className="text-xs text-slate-400 mt-1">Coba sesuaikan filter atau lakukan import batch baru</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL (Displays Full 44 Baseline Attributes + Audit Trail) */}
      <Modal
        isOpen={!!selectedWo && !showStatusModal}
        onClose={() => setSelectedWo(null)}
        title={`Work Order Detail: ${selectedWo?.wo_number}`}
        maxWidth="4xl"
      >
        {selectedWo && (
          <div className="space-y-6">
            {/* Top Status Banner */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Nomor Work Order</p>
                <p className="font-mono text-lg font-extrabold text-sky-400">{selectedWo.wo_number}</p>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Status Agent</p>
                  <Badge variant="agent" status={selectedWo.status_wo_agent} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Status Teknisi</p>
                  <Badge variant="installer" status={selectedWo.status_wo_installer} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">System Status</p>
                  <Badge variant="system" status={selectedWo.system_status} />
                </div>
              </div>
            </div>

            {/* Grid 44 Attribute Inspector */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Baseline 44 Kolom Sumber (WebJaws Specification)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Date (Jadwal)</span>
                  <span className="font-semibold text-white">{selectedWo.date || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">File Name</span>
                  <span className="font-semibold text-white truncate block">{selectedWo.file_name || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Date Upload</span>
                  <span className="font-semibold text-white">{selectedWo.date_upload ? selectedWo.date_upload.split('T')[0] : '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ID Customer</span>
                  <span className="font-semibold text-white font-mono">{selectedWo.id_customer || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Customer Name</span>
                  <span className="font-semibold text-white">{selectedWo.customer_name || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Customer Phone</span>
                  <span className="font-semibold text-white font-mono">{selectedWo.customer_phone || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Contactor Name</span>
                  <span className="font-semibold text-white">{selectedWo.contactor_name || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Area</span>
                  <span className="font-semibold text-sky-400">{selectedWo.area || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Installer Name</span>
                  <span className="font-semibold text-white">{selectedWo.installer_name || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Slot Time</span>
                  <span className="font-semibold text-white">{selectedWo.slot_time || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">FDT Code</span>
                  <span className="font-semibold text-white font-mono">{selectedWo.fdt_code || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">FAT Code</span>
                  <span className="font-semibold text-white font-mono">{selectedWo.fat_code || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Ticket Number</span>
                  <span className="font-semibold text-white font-mono">{selectedWo.ticket_number || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Ticket Category</span>
                  <span className="font-semibold text-white">{selectedWo.ticket_category || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 col-span-2">
                  <span className="text-[10px] text-slate-400 block">Alamat / Street Name</span>
                  <span className="font-semibold text-white">{selectedWo.street_name || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Cluster Name</span>
                  <span className="font-semibold text-white">{selectedWo.cluster_name || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Reason WO Agent</span>
                  <span className="font-semibold text-white">{selectedWo.reason_wo_agent || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Rootcause WO Agent</span>
                  <span className="font-semibold text-white">{selectedWo.rootcause_wo_agent || '-'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Reason WO Installer</span>
                  <span className="font-semibold text-white">{selectedWo.reason_wo_installer || '-'}</span>
                </div>
              </div>
            </div>

            {/* Status History Audit Trail */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Riwayat Perubahan Status (Audit Trail)
              </h4>
              {woHistory.length > 0 ? (
                <div className="space-y-2">
                  {woHistory.map((h, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="font-bold text-white">{h.changed_by_name} ({h.role})</span>
                        <span className="text-[10px]">{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300">
                        Agent: <span className="text-sky-400 font-semibold">{h.new_agent_status || '-'}</span> &bull; 
                        Installer: <span className="text-emerald-400 font-semibold">{h.new_installer_status || '-'}</span>
                      </p>
                      {h.remarks && <p className="text-slate-400 text-[11px] mt-1">Catatan: {h.remarks}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  Belum ada riwayat perubahan status manual untuk tiket ini.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* UPDATE STATUS AGENT MODAL */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title={`Review Status Agent: ${selectedWo?.wo_number}`}
        footer={
          <>
            <button
              onClick={() => setShowStatusModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
            >
              Batal
            </button>
            <button
              onClick={handleSaveAgentStatus}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-600/30 cursor-pointer"
            >
              Simpan Review Dispatch
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Status WO Agent</label>
            <select
              value={statusFormData.status_wo_agent}
              onChange={(e) => setStatusFormData({ ...statusFormData, status_wo_agent: e.target.value })}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            >
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Cancel">Cancel</option>
              <option value="Reschedule">Reschedule</option>
              <option value="Unhandled">Unhandled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Reason WO Agent</label>
            <input
              type="text"
              value={statusFormData.reason_wo_agent}
              onChange={(e) => setStatusFormData({ ...statusFormData, reason_wo_agent: e.target.value })}
              placeholder="e.g. Pelanggan Tidak Ada di Tempat / Sinyal OK"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Rootcause WO Agent</label>
            <input
              type="text"
              value={statusFormData.rootcause_wo_agent}
              onChange={(e) => setStatusFormData({ ...statusFormData, rootcause_wo_agent: e.target.value })}
              placeholder="e.g. Customer Not At Home / Port FAT OK"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Remarks WO Agent</label>
            <textarea
              rows={3}
              value={statusFormData.remarks_wo_agent}
              onChange={(e) => setStatusFormData({ ...statusFormData, remarks_wo_agent: e.target.value })}
              placeholder="Catatan verifikasi dispatch..."
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Workflow check: WO Complete approval */}
          {statusFormData.status_wo_agent === 'Approved' && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statusFormData.approve_complete}
                  onChange={(e) => setStatusFormData({ ...statusFormData, approve_complete: e.target.checked })}
                  className="rounded border-emerald-500 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-300">Setujui dan Selesaikan (WO Complete)</span>
                  <p className="text-[11px] text-slate-400">
                    Sesuai workflow WebJaws: Approved Agent hanya menyelesaikan WO jika Dispatch mengonfirmasi persetujuan selesai.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
