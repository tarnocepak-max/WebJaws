import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Calendar,
  Send,
  MessageCircle,
  FileCheck,
  RefreshCw,
  Phone,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { WorkOrder } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

export const InstallerDashboardPage: React.FC = () => {
  const { user, appConfig } = useAuth();
  const [tickets, setTickets] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null);

  // Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    status_wo_installer: 'Done',
    reason_wo_installer: '',
    rootcause_wo_installer: '',
    remarks_wo_installer: '',
  });

  // WhatsApp confirmation text modal
  const [showWaModal, setShowWaModal] = useState(false);
  const [waText, setWaText] = useState('');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getWorkOrders({ limit: '50' });
      setTickets(res.workOrders);
    } catch (err) {
      console.error('Failed to load installer tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleOpenReport = (wo: WorkOrder) => {
    setSelectedWo(wo);
    setReportForm({
      status_wo_installer: wo.status_wo_installer === 'Unhandled' ? 'Done' : wo.status_wo_installer,
      reason_wo_installer: wo.reason_wo_installer || '',
      rootcause_wo_installer: wo.rootcause_wo_installer || '',
      remarks_wo_installer: wo.remarks_wo_installer || '',
    });
    setShowReportModal(true);
  };

  const handleSaveReport = async () => {
    if (!selectedWo) return;
    try {
      await api.updateInstallerStatus(selectedWo.id, reportForm);
      setShowReportModal(false);
      await fetchTickets();
    } catch (err: any) {
      alert(`Error submitting installer report: ${err.message}`);
    }
  };

  const handleGenerateWa = (wo: WorkOrder) => {
    const template = appConfig?.whatsappTemplate ||
      'Halo Bpk/Ibu {{customer_name}}, kami dari teknisi {{installer_name}} ({{contractor_name}}) konfirmasi pemasangan WO {{wo_number}} di {{street_name}} slot {{slot_time}}.';

    const text = template
      .replace(/{{customer_name}}/g, wo.customer_name || 'Pelanggan')
      .replace(/{{installer_name}}/g, wo.installer_name || user?.full_name || 'Teknisi')
      .replace(/{{contractor_name}}/g, wo.contactor_name || user?.contractor_name || 'Mitra')
      .replace(/{{wo_number}}/g, wo.wo_number)
      .replace(/{{street_name}}/g, wo.street_name || 'Alamat Lokasi')
      .replace(/{{slot_time}}/g, wo.slot_time || 'Jadwal Hari Ini');

    setWaText(text);
    setSelectedWo(wo);
    setShowWaModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-orange-400" />
            Installer Field Hub
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Daftar Penugasan Tiket Lapangan untuk: <strong className="text-white">{user?.full_name}</strong>
          </p>
        </div>

        <button
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          <span>Segarkan Tiket</span>
        </button>
      </div>

      {/* Ticket List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tickets.length > 0 ? (
          tickets.map((wo) => (
            <div
              key={wo.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-mono text-sm font-bold text-sky-400">{wo.wo_number}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">{wo.ticket_number || 'New Installation'}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="installer" status={wo.status_wo_installer} />
                    <span className="text-[10px] text-slate-400 font-mono">{wo.slot_time || '08:00 - 10:00'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{wo.customer_name}</span>
                    <a
                      href={`tel:${wo.customer_phone}`}
                      className="flex items-center gap-1 text-emerald-400 font-mono text-xs hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      {wo.customer_phone}
                    </a>
                  </div>
                  <p className="text-slate-300 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>{wo.street_name || '-'}</span>
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                    <span>FAT: {wo.fat_code || '-'}</span>
                    <span>FDT: {wo.fdt_code || '-'}</span>
                    <span>Area: {wo.area || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => handleGenerateWa(wo)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Kirim WA</span>
                </button>

                <button
                  onClick={() => handleOpenReport(wo)}
                  className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold shadow-lg shadow-orange-600/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Lapor Hasil</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-slate-300">Tidak ada tiket yang ditugaskan kepada Anda saat ini.</p>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title={`Laporan Lapangan Installer: ${selectedWo?.wo_number}`}
        footer={
          <>
            <button
              onClick={() => setShowReportModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
            >
              Batal
            </button>
            <button
              onClick={handleSaveReport}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30 cursor-pointer"
            >
              Kirim Laporan Progres
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Status Progres Pengerjaan</label>
            <select
              value={reportForm.status_wo_installer}
              onChange={(e) => setReportForm({ ...reportForm, status_wo_installer: e.target.value })}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            >
              <option value="Done">Done (Selesai Pasang)</option>
              <option value="Pending">Pending (Tertunda Kendala)</option>
              <option value="Reschedule">Reschedule (Minta Jadwal Ulang)</option>
              <option value="Unhandled">Unhandled (Belum Pengerjaan)</option>
            </select>
            <p className="text-[11px] text-amber-400 mt-1">
              Catatan: Memilih 'Done' akan mengirimkan laporan untuk diverifikasi oleh Agent Dispatch, bukan langsung menyelesaikan tiket.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Reason WO Installer</label>
            <input
              type="text"
              value={reportForm.reason_wo_installer}
              onChange={(e) => setReportForm({ ...reportForm, reason_wo_installer: e.target.value })}
              placeholder="e.g. Sinyal Redaman Baik / Pelanggan Tidak di Lokasi"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Rootcause WO Installer</label>
            <input
              type="text"
              value={reportForm.rootcause_wo_installer}
              onChange={(e) => setReportForm({ ...reportForm, rootcause_wo_installer: e.target.value })}
              placeholder="e.g. ONT Normal / Port FAT Rusak"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Remarks WO Installer</label>
            <textarea
              rows={3}
              value={reportForm.remarks_wo_installer}
              onChange={(e) => setReportForm({ ...reportForm, remarks_wo_installer: e.target.value })}
              placeholder="Keterangan uji coba redaman, nomor seri ONT, atau kendala lapangan..."
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      </Modal>

      {/* WhatsApp Template Generator Modal */}
      <Modal
        isOpen={showWaModal}
        onClose={() => setShowWaModal(false)}
        title={`Konfirmasi WhatsApp Pelanggan: ${selectedWo?.wo_number}`}
        footer={
          <button
            onClick={() => {
              navigator.clipboard.writeText(waText);
              alert('Teks WhatsApp disalin ke clipboard!');
              setShowWaModal(false);
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            Salin Pesan ke Clipboard
          </button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Pesan terisi otomatis dari template konfigurasi Superadmin:
          </p>
          <textarea
            rows={5}
            value={waText}
            onChange={(e) => setWaText(e.target.value)}
            className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-sans focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </Modal>
    </div>
  );
};
