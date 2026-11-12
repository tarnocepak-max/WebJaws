import { Router, Response } from 'express';
import crypto from 'crypto';
import * as xlsx from 'xlsx';
import { webJawsStore, WorkOrder } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, requireRole, getClientIp } from '../auth/auth.js';

export const importRouter = Router();

importRouter.use(requireAuth);

export const BASELINE_44_HEADERS = [
  'Date',
  'File Name',
  'Date Upload',
  'Date Assign Agent',
  'Date Assign Teknisi',
  'Agent ID',
  'ID Customer',
  'WO Number',
  'Customer Name',
  'Customer Phone',
  'Customer Phone2',
  'Customer Phone3',
  'Contactor Name',
  'Area',
  'Installer Name',
  'Slot Time',
  'Street Name',
  'Street Alternatif',
  'Cluster Name',
  'FDT Code',
  'FAT Code',
  'Ticket Number',
  'Ticket Category',
  'Date Report Agent',
  'Status WO Agent',
  'Reason WO Agent',
  'Rootcause WO Agent',
  'Remarks WO Agent',
  'Date Report Installer',
  'Date Report Installer2',
  'Status WO Installer',
  'Reason WO Installer',
  'Rootcause WO Installer',
  'Remarks WO Installer',
  'Destination Call',
  'Reason Call',
  'Remarks Call',
  'Agent TA',
  'Status TA',
  'Remarks TA',
  'Flag',
  'Agent Ret',
  'Status Ret',
  'Remarks Ret',
];

// Helper to normalize header names for matching
export function normalizeHeader(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Delimiter auto-detector for Text-to-Table and CSV
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ',';

  const firstFew = lines.slice(0, 5);
  const delimiters = ['\t', ';', ',', '|'];
  let bestDelim = ',';
  let bestScore = -1;

  for (const delim of delimiters) {
    const counts = firstFew.map((l) => l.split(delim).length);
    // If every row has > 1 column and counts are consistent
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (min > 1 && max - min <= 2) {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      if (avg > bestScore) {
        bestScore = avg;
        bestDelim = delim;
      }
    }
  }

  return bestDelim;
}

// Map parsed raw object row to internal WorkOrder fields
export function mapRowToWO(rawRow: Record<string, any>, headerMap: Record<string, string>, fileName: string): Partial<WorkOrder> {
  const getVal = (stdHeader: string): string => {
    // Find key mapped to this standard header
    for (const [rawKey, mappedStd] of Object.entries(headerMap)) {
      if (mappedStd === stdHeader && rawRow[rawKey] !== undefined && rawRow[rawKey] !== null) {
        return String(rawRow[rawKey]).trim();
      }
    }
    // Direct match check
    if (rawRow[stdHeader] !== undefined && rawRow[stdHeader] !== null) {
      return String(rawRow[stdHeader]).trim();
    }
    return '';
  };

  const woNumber = getVal('WO Number');
  const dateStr = getVal('Date') || new Date().toISOString().split('T')[0];

  return {
    wo_number: woNumber,
    date: dateStr,
    file_name: fileName || getVal('File Name') || 'Direct_Text_Import',
    date_upload: new Date().toISOString(),
    date_assign_agent: getVal('Date Assign Agent'),
    date_assign_teknisi: getVal('Date Assign Teknisi'),
    agent_id: getVal('Agent ID'),
    id_customer: getVal('ID Customer'),
    customer_name: getVal('Customer Name'),
    customer_phone: getVal('Customer Phone'),
    customer_phone2: getVal('Customer Phone2'),
    customer_phone3: getVal('Customer Phone3'),
    contactor_name: getVal('Contactor Name'),
    area: getVal('Area'),
    installer_name: getVal('Installer Name'),
    slot_time: getVal('Slot Time'),
    street_name: getVal('Street Name'),
    street_alternatif: getVal('Street Alternatif'),
    cluster_name: getVal('Cluster Name'),
    fdt_code: getVal('FDT Code'),
    fat_code: getVal('FAT Code'),
    ticket_number: getVal('Ticket Number'),
    ticket_category: getVal('Ticket Category'),
    date_report_agent: getVal('Date Report Agent'),
    status_wo_agent: (getVal('Status WO Agent') as any) || 'Unhandled',
    reason_wo_agent: getVal('Reason WO Agent'),
    rootcause_wo_agent: getVal('Rootcause WO Agent'),
    remarks_wo_agent: getVal('Remarks WO Agent'),
    date_report_installer: getVal('Date Report Installer'),
    date_report_installer2: getVal('Date Report Installer2'),
    status_wo_installer: (getVal('Status WO Installer') as any) || 'Unhandled',
    reason_wo_installer: getVal('Reason WO Installer'),
    rootcause_wo_installer: getVal('Rootcause WO Installer'),
    remarks_wo_installer: getVal('Remarks WO Installer'),
    destination_call: getVal('Destination Call'),
    reason_call: getVal('Reason Call'),
    remarks_call: getVal('Remarks Call'),
    agent_ta: getVal('Agent TA'),
    status_ta: getVal('Status TA'),
    remarks_ta: getVal('Remarks TA'),
    flag: getVal('Flag'),
    agent_ret: getVal('Agent Ret'),
    status_ret: getVal('Status Ret'),
    remarks_ret: getVal('Remarks Ret'),
    system_status: 'Requested',
  };
}

// POST /api/import/preview - Parse Text, CSV, or Table rows and run validation
importRouter.post('/preview', requireRole(['Superadmin', 'Agent Dispatch']), (req: AuthenticatedRequest, res: Response) => {
  const { rawText, method, fileName = 'Import_Batch.csv', base64Data, manualDelimiter } = req.body;

  let rawRows: Array<Record<string, any>> = [];
  let detectedHeaders: string[] = [];
  let detectedDelim = manualDelimiter || ',';

  try {
    if (method === 'excel' && base64Data) {
      const buffer = Buffer.from(base64Data, 'base64');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (json.length > 0) {
        detectedHeaders = Object.keys(json[0]);
        rawRows = json;
      }
    } else if (rawText && typeof rawText === 'string') {
      detectedDelim = manualDelimiter || detectDelimiter(rawText);
      const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const headerLine = lines[0];
        detectedHeaders = headerLine.split(detectedDelim).map((h) => h.trim().replace(/^["']|["']$/g, ''));

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(detectedDelim).map((c) => c.trim().replace(/^["']|["']$/g, ''));
          const rowObj: Record<string, string> = {};
          detectedHeaders.forEach((h, idx) => {
            rowObj[h] = cells[idx] || '';
          });
          rawRows.push(rowObj);
        }
      }
    }
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: `Failed to parse import source: ${err.message}`,
    });
  }

  if (rawRows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid data rows found in the provided source.',
    });
  }

  // Header Auto-Mapping to Baseline 44 Headers
  const headerMapping: Record<string, string> = {};
  const unmappedHeaders: string[] = [];

  detectedHeaders.forEach((rawH) => {
    const norm = normalizeHeader(rawH);
    const match = BASELINE_44_HEADERS.find((stdH) => normalizeHeader(stdH) === norm);
    if (match) {
      headerMapping[rawH] = match;
    } else {
      // Special aliases
      if (norm === 'contractorname') headerMapping[rawH] = 'Contactor Name';
      else if (norm === 'wonumber' || norm === 'nomorwo' || norm === 'woid') headerMapping[rawH] = 'WO Number';
      else if (norm === 'customername' || norm === 'namapelanggan') headerMapping[rawH] = 'Customer Name';
      else if (norm === 'customerphone' || norm === 'telepon' || norm === 'nohp') headerMapping[rawH] = 'Customer Phone';
      else {
        unmappedHeaders.push(rawH);
      }
    }
  });

  // Validation & Duplicate Detection
  const existingWoNumbers = new Set(webJawsStore.workOrders.map((w) => w.wo_number.toLowerCase().trim()));
  const seenInBatch = new Set<string>();

  const validRows: any[] = [];
  const rowErrors: Array<{ rowIndex: number; error: string; rawRow: any }> = [];
  let duplicateCount = 0;

  rawRows.forEach((row, idx) => {
    const mapped = mapRowToWO(row, headerMapping, fileName);
    const woNum = mapped.wo_number ? mapped.wo_number.trim() : '';

    if (!woNum) {
      rowErrors.push({
        rowIndex: idx + 1,
        error: 'Missing required WO Number',
        rawRow: row,
      });
      return;
    }

    const lowerWo = woNum.toLowerCase();
    if (existingWoNumbers.has(lowerWo) || seenInBatch.has(lowerWo)) {
      duplicateCount++;
      rowErrors.push({
        rowIndex: idx + 1,
        error: `Duplicate WO Number '${woNum}' (already exists in system or batch)`,
        rawRow: row,
      });
      return;
    }

    seenInBatch.add(lowerWo);
    validRows.push(mapped);
  });

  return res.json({
    success: true,
    summary: {
      totalRows: rawRows.length,
      validRows: validRows.length,
      errorRows: rowErrors.length,
      duplicateRows: duplicateCount,
      detectedDelimiter: detectedDelim,
      detectedHeadersCount: detectedHeaders.length,
      unmappedHeaders,
      fileName,
    },
    headerMapping,
    previewRows: validRows.slice(0, 15),
    rowErrors: rowErrors.slice(0, 50),
    allValidRows: validRows, // for quick confirmation
  });
});

// POST /api/import/confirm - Commit validated rows to database
importRouter.post('/confirm', requireRole(['Superadmin', 'Agent Dispatch']), (req: AuthenticatedRequest, res: Response) => {
  const { validRows, fileName, importMethod } = req.body;

  if (!Array.isArray(validRows) || validRows.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid rows provided for confirmation' });
  }

  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;

  const existingWoNumbers = new Set(webJawsStore.workOrders.map((w) => w.wo_number.toLowerCase().trim()));

  for (const row of validRows) {
    const woNum = row.wo_number?.trim();
    if (!woNum || existingWoNumbers.has(woNum.toLowerCase())) {
      skipped++;
      continue;
    }

    const newWo: WorkOrder = {
      id: crypto.randomUUID(),
      wo_number: woNum,
      date: row.date || now.split('T')[0],
      file_name: fileName || row.file_name || 'Import_Batch',
      date_upload: now,
      date_assign_agent: row.date_assign_agent || undefined,
      date_assign_teknisi: row.date_assign_teknisi || undefined,
      agent_id: row.agent_id || undefined,
      id_customer: row.id_customer ? String(row.id_customer) : undefined,
      customer_name: row.customer_name || undefined,
      customer_phone: row.customer_phone ? String(row.customer_phone) : undefined,
      customer_phone2: row.customer_phone2 ? String(row.customer_phone2) : undefined,
      customer_phone3: row.customer_phone3 ? String(row.customer_phone3) : undefined,
      contactor_name: row.contactor_name || undefined,
      area: row.area || undefined,
      installer_name: row.installer_name || undefined,
      slot_time: row.slot_time || undefined,
      street_name: row.street_name || undefined,
      street_alternatif: row.street_alternatif || undefined,
      cluster_name: row.cluster_name || undefined,
      fdt_code: row.fdt_code || undefined,
      fat_code: row.fat_code || undefined,
      ticket_number: row.ticket_number || undefined,
      ticket_category: row.ticket_category || undefined,
      date_report_agent: row.date_report_agent || undefined,
      status_wo_agent: row.status_wo_agent || 'Unhandled',
      reason_wo_agent: row.reason_wo_agent || undefined,
      rootcause_wo_agent: row.rootcause_wo_agent || undefined,
      remarks_wo_agent: row.remarks_wo_agent || undefined,
      date_report_installer: row.date_report_installer || undefined,
      date_report_installer2: row.date_report_installer2 || undefined,
      status_wo_installer: row.status_wo_installer || 'Unhandled',
      reason_wo_installer: row.reason_wo_installer || undefined,
      rootcause_wo_installer: row.rootcause_wo_installer || undefined,
      remarks_wo_installer: row.remarks_wo_installer || undefined,
      destination_call: row.destination_call || undefined,
      reason_call: row.reason_call || undefined,
      remarks_call: row.remarks_call || undefined,
      agent_ta: row.agent_ta || undefined,
      status_ta: row.status_ta || undefined,
      remarks_ta: row.remarks_ta || undefined,
      flag: row.flag || undefined,
      agent_ret: row.agent_ret || undefined,
      status_ret: row.status_ret || undefined,
      remarks_ret: row.remarks_ret || undefined,
      system_status: 'Requested',
      import_batch_id: batchId,
      created_at: now,
      updated_at: now,
    };

    webJawsStore.workOrders.unshift(newWo);
    existingWoNumbers.add(woNum.toLowerCase());
    inserted++;
  }

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'IMPORT_WORK_ORDERS',
    module: 'Import WO',
    record_id: batchId,
    diff_data: { batchId, fileName, inserted, skipped, method: importMethod },
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `Import confirmed: ${inserted} Work Orders successfully committed into WebJaws database. (${skipped} duplicates skipped)`,
    batchId,
    insertedCount: inserted,
    skippedCount: skipped,
  });
});
