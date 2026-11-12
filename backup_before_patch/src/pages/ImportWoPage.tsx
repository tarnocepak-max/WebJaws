import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Table,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import { BASELINE_44_HEADERS } from '../../server/routes/importRoutes';

export const ImportWoPage: React.FC = () => {
  const [importMethod, setImportMethod] = useState<'excel' | 'csv' | 'paste_text' | 'text_to_table'>('paste_text');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('WORK_ORDER_IMPORT.csv');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Result state
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generates complete 44-column TSV sample data for quick testing
  const loadSampleData = () => {
    const headers = [
      'Date', 'File Name', 'Date Upload', 'Date Assign Agent', 'Date Assign Teknisi',
      'Agent ID', 'ID Customer', 'WO Number', 'Customer Name', 'Customer Phone',
      'Customer Phone2', 'Customer Phone3', 'Contactor Name', 'Area', 'Installer Name',
      'Slot Time', 'Street Name', 'Street Alternatif', 'Cluster Name', 'FDT Code',
      'FAT Code', 'Ticket Number', 'Ticket Category', 'Date Report Agent', 'Status WO Agent',
      'Reason WO Agent', 'Rootcause WO Agent', 'Remarks WO Agent', 'Date Report Installer',
      'Date Report Installer2', 'Status WO Installer', 'Reason WO Installer',
      'Rootcause WO Installer', 'Remarks WO Installer', 'Destination Call', 'Reason Call',
      'Remarks Call', 'Agent TA', 'Status TA', 'Remarks TA', 'Flag', 'Agent Ret',
      'Status Ret', 'Remarks Ret'
    ];

    const sampleRows = [
      [
        '2026-11-12', 'MORA_IMPORT_01.csv', '2026-11-12', '2026-11-12', '',
        'AGT-101', 'CUST-77201', `WO-202611-${Math.floor(1000 + Math.random() * 9000)}`, 'Rahmat Hidayat', '081234112233',
        '', '', 'PT Fiber Optik Nusantara', 'Jakarta Selatan', 'Budi Santoso (Installer)',
        '10:00 - 12:00', 'Jl. Tebet Timur Dalam No. 15', '', 'Tebet Mas', 'FDT-TBT-01',
        'FAT-TBT-01/04', 'TCK-9901', 'New Installation', '', 'Unhandled',
        '', '', '', '',
        '', 'Unhandled', '',
        '', '', 'Customer', 'Confirmation',
        'Pelanggan konfirmasi hadir di rumah', 'AGT-101', 'Verified', 'Siap teknisi', 'Regular', '',
        '', ''
      ],
      [
        '2026-11-12', 'MORA_IMPORT_01.csv', '2026-11-12', '2026-11-12', '',
        'AGT-102', 'CUST-77202', `WO-202611-${Math.floor(1000 + Math.random() * 9000)}`, 'Melinda Susanti', '081799887766',
        '081399887767', '', 'PT Citra Telekomunikasi', 'Jakarta Timur', '',
        '13:00 - 15:00', 'Jl. Pahlawan Revolusi No. 89', 'Gang Haji Somad', 'Klender Green', 'FDT-KLD-02',
        'FAT-KLD-02/10', 'TCK-9902', 'New Installation', '', 'Unhandled',
        '', '', '', '',
        '', 'Unhandled', '',
        '', '', '', '',
        '', '', '', '', 'VIP', '',
        '', ''
      ]
    ];

    const tsvContent = [headers.join('\t'), ...sampleRows.map((r) => r.join('\t'))].join('\n');
    setRawText(tsvContent);
    setFileName('MORA_IMPORT_01.tsv');
    setImportSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileName(file.name);
    setImportSuccessMessage(null);
    setErrorMessage(null);

    const reader = new FileReader();
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setImportMethod('excel');
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string)?.split(',')[1];
        if (base64Data) {
          triggerPreview({ method: 'excel', base64Data, fileName: file.name });
        }
      };
      reader.readAsDataURL(file);
    } else {
      // CSV or plain text
      setImportMethod('csv');
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
        triggerPreview({ method: 'csv', rawText: text, fileName: file.name });
      };
      reader.readAsText(file);
    }
  };

  const triggerPreview = async (params?: { rawText?: string; method?: string; fileName?: string; base64Data?: string }) => {
    setParsing(true);
    setErrorMessage(null);
    setImportSuccessMessage(null);

    const payload = {
      rawText: params?.rawText !== undefined ? params.rawText : rawText,
      method: params?.method || importMethod,
      fileName: params?.fileName || fileName,
      base64Data: params?.base64Data,
    };

    try {
      const res = await api.previewImport(payload);
      setPreviewResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses struktur import.');
      setPreviewResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewResult || !previewResult.allValidRows || previewResult.allValidRows.length === 0) {
      alert('Tidak ada baris data valid yang siap dikonfirmasi.');
      return;
    }

    setCommitting(true);
    try {
      const res = await api.confirmImport(
        previewResult.allValidRows,
        previewResult.summary.fileName,
        importMethod
      );
      setImportSuccessMessage(res.message);
      setPreviewResult(null);
      setRawText('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan data import.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Import Work Order (WO) &amp; Text-to-Table
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Mendukung 44 Header Standar WebJaws / MoraJaws dengan Deteksi Otomatis Delimiter &amp; Validasi Duplikasi
          </p>
        </div>

        <button
          onClick={loadSampleData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-400 border border-slate-700 transition cursor-pointer self-start sm:self-auto"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Isi Contoh Format 44 Kolom</span>
        </button>
      </div>

      {/* Success / Error Alerts */}
      {importSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{importSuccessMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Method Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-800">
          <button
            onClick={() => setImportMethod('paste_text')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              importMethod === 'paste_text'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>3. Paste Text (Auto Delimiter)</span>
          </button>

          <button
            onClick={() => setImportMethod('text_to_table')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              importMethod === 'text_to_table'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>4. Text-to-Table</span>
          </button>

          <label
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              importMethod === 'excel'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>1. Upload Excel (.xlsx)</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </label>

          <label
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              importMethod === 'csv'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>2. Upload CSV (.csv)</span>
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Input Text Area for Paste Text & Text-to-Table */}
        {(importMethod === 'paste_text' || importMethod === 'text_to_table') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                Tempel Data Teks (Tab, Koma, Titik Koma, atau Pipe Separated):
              </label>
              <span className="text-[11px] text-slate-400">
                Nama File Batch: <span className="text-white font-mono">{fileName}</span>
              </span>
            </div>

            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste baris data termasuk header di sini... Sistem akan otomatis mendeteksi delimiter tab (\t), koma (,), semicolon (;), atau pipe (|)."
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <div className="flex justify-end">
              <button
                onClick={() => triggerPreview()}
                disabled={parsing || !rawText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold shadow-lg shadow-sky-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {parsing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mendeteksi Header &amp; Validasi...</span>
                  </>
                ) : (
                  <>
                    <span>Proses Preview &amp; Validasi Data</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* File Upload Status Note */}
        {(importMethod === 'excel' || importMethod === 'csv') && selectedFile && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-xs font-bold text-white">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB &bull; Siap diproses</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW & VALIDATION RESULTS */}
      {previewResult && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Baris Terbaca</p>
              <p className="text-2xl font-black text-white mt-1">{previewResult.summary.totalRows}</p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Baris Valid (Siap Simpan)</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">{previewResult.summary.validRows}</p>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Baris Error</p>
              <p className="text-2xl font-black text-rose-300 mt-1">{previewResult.summary.errorRows}</p>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Duplikasi WO</p>
              <p className="text-2xl font-black text-amber-300 mt-1">{previewResult.summary.duplicateRows}</p>
            </div>
          </div>

          {/* Delimiter & Header Recognition Pill */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">Delimiter Terdeteksi:</span>
              <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-400 font-bold">
                {previewResult.summary.detectedDelimiter === '\t' ? 'TAB (\\t)' : previewResult.summary.detectedDelimiter}
              </span>
              <span className="text-slate-400">&bull; Kolom Terpetakan: {previewResult.summary.detectedHeadersCount} / 44</span>
            </div>

            {/* ALWAYS ACCESSIBLE CONFIRM BUTTON */}
            <button
              onClick={handleConfirmImport}
              disabled={committing || previewResult.summary.validRows === 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {committing ? (
                <span>Menyimpan ke Database...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi &amp; Simpan {previewResult.summary.validRows} WO ke Database</span>
                </>
              )}
            </button>
          </div>

          {/* Error Row Inspector if errors exist */}
          {previewResult.rowErrors && previewResult.rowErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Detail Error Validasi Per Baris:</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                {previewResult.rowErrors.map((err: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-slate-950/60 border border-rose-900/50 text-slate-300 flex items-center justify-between">
                    <span>
                      <strong className="text-rose-400">Baris {err.rowIndex}:</strong> {err.error}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      WO: {err.rawRow['WO Number'] || err.rawRow['wo_number'] || 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Table Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Preview Data Valid (Maksimal 15 Baris Pertama)
              </h3>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs table-compact whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">WO Number</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Contractor</th>
                    <th className="py-2.5 px-3">Area</th>
                    <th className="py-2.5 px-3">Slot Time</th>
                    <th className="py-2.5 px-3">FAT Code</th>
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Alamat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {previewResult.previewRows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-bold text-sky-400">{row.wo_number}</td>
                      <td className="py-2 px-3 text-slate-300">{row.date}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-white">{row.customer_name}</td>
                      <td className="py-2 px-3 text-slate-400">{row.customer_phone}</td>
                      <td className="py-2 px-3 font-sans text-slate-200">{row.contactor_name}</td>
                      <td className="py-2 px-3 font-sans text-sky-400">{row.area}</td>
                      <td className="py-2 px-3 text-slate-300">{row.slot_time}</td>
                      <td className="py-2 px-3 text-slate-400">{row.fat_code}</td>
                      <td className="py-2 px-3 text-slate-400">{row.ticket_number}</td>
                      <td className="py-2 px-3 font-sans text-slate-400 truncate max-w-xs">{row.street_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
