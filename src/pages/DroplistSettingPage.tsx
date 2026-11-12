import React, { useState, useEffect, useCallback } from 'react';
import {
  ListOrdered,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Folder,
} from 'lucide-react';
import { api } from '../api/client';
import { DropdownOption } from '../types';

export const DroplistSettingPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('status_agent');
  const [droplists, setDroplists] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Item State
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const categories = [
    { id: 'status_agent', label: '10. Status WO Agent' },
    { id: 'status_installer', label: '11. Status WO Installer' },
    { id: 'reason_agent', label: '12. Reason WO Agent' },
    { id: 'rootcause_agent', label: '12. Rootcause WO Agent' },
    { id: 'contractor', label: 'Daftar Contractor' },
    { id: 'area', label: 'Daftar Area Operasional' },
    { id: 'slot_time', label: 'Slot Waktu Pengerjaan' },
  ];

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDroplists(selectedCategory);
      setDroplists(res.droplists);
    } catch (err) {
      console.error('Failed to load droplists:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    try {
      await api.addDroplist({
        category: selectedCategory,
        label: newLabel.trim(),
        value: newValue.trim() || newLabel.trim(),
      });
      setNewLabel('');
      setNewValue('');
      await fetchItems();
    } catch (err: any) {
      alert(`Error adding option: ${err.message}`);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Hapus pilihan droplist ini?')) {
      try {
        await api.deleteDroplist(id);
        await fetchItems();
      } catch (err: any) {
        alert(`Error deleting option: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-sky-400" />
            Setting Droplist &amp; Status Operasional
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dikelola Terpusat oleh Superadmin &bull; Berubah Otomatis pada Form dan Filter Seluruh Staff
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Category Selector */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">
            Kategori Droplist
          </p>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Droplist Items Manager */}
        <div className="md:col-span-3 space-y-4">
          {/* Add Item Card */}
          <form onSubmit={handleAddItem} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <p className="text-xs font-bold text-white uppercase tracking-wider">
              + Tambah Opsi untuk: <span className="text-sky-400">{categories.find((c) => c.id === selectedCategory)?.label}</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Label Tampilan</label>
                <input
                  type="text"
                  required
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    if (!newValue) setNewValue(e.target.value);
                  }}
                  placeholder="e.g. Sinyal Kurang Bagus"
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Nilai Database (Value)</label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g. Sinyal Kurang Bagus"
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambahkan ke Droplist</span>
              </button>
            </div>
          </form>

          {/* List of items */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Daftar Pilihan Aktif ({droplists.length} Opsi)
              </span>
              <button onClick={fetchItems} className="text-slate-400 hover:text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              </button>
            </div>

            <div className="divide-y divide-slate-800">
              {droplists.length > 0 ? (
                droplists.map((item, idx) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-slate-800/40 transition">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-400 w-5">{idx + 1}.</span>
                      <div>
                        <span className="text-xs font-bold text-white">{item.label}</span>
                        <span className="text-[11px] text-slate-400 block font-mono">Value: {item.value}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Hapus Opsi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada opsi untuk kategori ini
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
