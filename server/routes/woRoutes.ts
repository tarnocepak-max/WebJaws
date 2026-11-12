import { Router, Response } from 'express';
import crypto from 'crypto';
import { webJawsStore, WorkOrder, WOStatusHistory } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, getClientIp } from '../auth/auth.js';

export const woRouter = Router();

woRouter.use(requireAuth);

// Helper function to apply Role-Based Access Control filters to work orders
export function filterWOsForUser(user: any, wos: WorkOrder[]): WorkOrder[] {
  if (user.role === 'Superadmin' || user.role === 'Agent Dispatch' || user.role === 'Monitoring Data' || user.role === 'IT Support Application') {
    return wos;
  }

  if (user.role === 'Leader') {
    return wos.filter((wo) => {
      let matchContractor = true;
      let matchArea = true;

      if (user.contractor_name && wo.contactor_name) {
        matchContractor = wo.contactor_name.toLowerCase().includes(user.contractor_name.toLowerCase()) ||
                          user.contractor_name.toLowerCase().includes(wo.contactor_name.toLowerCase());
      }
      if (user.area && wo.area) {
        matchArea = wo.area.toLowerCase().includes(user.area.toLowerCase()) ||
                    user.area.toLowerCase().includes(wo.area.toLowerCase());
      }
      return matchContractor && matchArea;
    });
  }

  if (user.role === 'Installer') {
    return wos.filter((wo) => {
      const matchId = wo.assigned_installer_id === user.id;
      const matchName = wo.installer_name && user.full_name &&
        wo.installer_name.toLowerCase().includes(user.full_name.toLowerCase());
      return matchId || matchName;
    });
  }

  return [];
}

// GET /api/work-orders - List work orders with RBAC and filtering
woRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let filtered = filterWOsForUser(user, webJawsStore.workOrders);

  const {
    status_agent,
    status_installer,
    system_status,
    contractor,
    area,
    search,
    sort_by = 'created_at',
    sort_dir = 'desc',
    page = '1',
    limit = '50',
  } = req.query;

  if (status_agent && typeof status_agent === 'string') {
    filtered = filtered.filter((w) => w.status_wo_agent.toLowerCase() === status_agent.toLowerCase());
  }

  if (status_installer && typeof status_installer === 'string') {
    filtered = filtered.filter((w) => w.status_wo_installer.toLowerCase() === status_installer.toLowerCase());
  }

  if (system_status && typeof system_status === 'string') {
    filtered = filtered.filter((w) => w.system_status.toLowerCase() === system_status.toLowerCase());
  }

  if (contractor && typeof contractor === 'string') {
    filtered = filtered.filter((w) => w.contactor_name && w.contactor_name.toLowerCase().includes(contractor.toLowerCase()));
  }

  if (area && typeof area === 'string') {
    filtered = filtered.filter((w) => w.area && w.area.toLowerCase().includes(area.toLowerCase()));
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (w) =>
        w.wo_number.toLowerCase().includes(q) ||
        (w.customer_name && w.customer_name.toLowerCase().includes(q)) ||
        (w.id_customer && w.id_customer.toLowerCase().includes(q)) ||
        (w.customer_phone && w.customer_phone.includes(q)) ||
        (w.ticket_number && w.ticket_number.toLowerCase().includes(q)) ||
        (w.fat_code && w.fat_code.toLowerCase().includes(q)) ||
        (w.installer_name && w.installer_name.toLowerCase().includes(q))
    );
  }

  // Sorting
  const sortByStr = String(sort_by);
  const isAsc = String(sort_dir).toLowerCase() === 'asc';

  filtered.sort((a: any, b: any) => {
    const valA = a[sortByStr] || '';
    const valB = b[sortByStr] || '';
    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 50);
  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  return res.json({
    success: true,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    workOrders: paginated,
  });
});

// GET /api/work-orders/stats - Operational Dashboard Metrics
woRouter.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const wos = filterWOsForUser(user, webJawsStore.workOrders);

  // Exact 8 Core Operational Cards requested in Section I:
  // 1. WO Requested
  // 2. Total WO
  // 3. Cancel
  // 4. Pending
  // 5. Reschedule
  // 6. Approved Agent
  // 7. Unhandled Agent
  // 8. Unhandled Installer
  const totalWO = wos.length;
  const woRequested = wos.filter((w) => w.system_status === 'Requested').length;
  const cancelCount = wos.filter((w) => w.status_wo_agent === 'Cancel').length;
  const pendingCount = wos.filter((w) => w.status_wo_agent === 'Pending' || w.status_wo_installer === 'Pending').length;
  const rescheduleCount = wos.filter((w) => w.status_wo_agent === 'Reschedule' || w.status_wo_installer === 'Reschedule').length;
  const approvedAgent = wos.filter((w) => w.status_wo_agent === 'Approved').length;
  const unhandledAgent = wos.filter((w) => w.status_wo_agent === 'Unhandled').length;
  const unhandledInstaller = wos.filter((w) => w.status_wo_installer === 'Unhandled').length;

  // Breakdown by Contractor
  const byContractor: Record<string, number> = {};
  // Breakdown by Area
  const byArea: Record<string, number> = {};
  // Breakdown by Installer
  const byInstaller: Record<string, number> = {};

  wos.forEach((w) => {
    const c = w.contactor_name || 'Unassigned Contractor';
    byContractor[c] = (byContractor[c] || 0) + 1;

    const a = w.area || 'Unassigned Area';
    byArea[a] = (byArea[a] || 0) + 1;

    const inst = w.installer_name || 'Unassigned Installer';
    byInstaller[inst] = (byInstaller[inst] || 0) + 1;
  });

  return res.json({
    success: true,
    stats: {
      woRequested,
      totalWO,
      cancelCount,
      pendingCount,
      rescheduleCount,
      approvedAgent,
      unhandledAgent,
      unhandledInstaller,
      breakdown: {
        byContractor,
        byArea,
        byInstaller,
      },
    },
  });
});

// GET /api/work-orders/:id - Single Work Order Detail
woRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);

  if (!wo) {
    return res.status(404).json({ success: false, error: 'Work Order not found' });
  }

  // Check role permission to view this WO
  const accessibleWos = filterWOsForUser(req.user!, [wo]);
  if (accessibleWos.length === 0) {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: You do not have permission to view this Work Order',
    });
  }

  const history = webJawsStore.statusHistory.filter((h) => h.wo_id === wo.id || h.wo_number === wo.wo_number);

  return res.json({
    success: true,
    workOrder: wo,
    statusHistory: history,
  });
});

// PATCH /api/work-orders/:id/agent-status - Agent Dispatch status review
woRouter.patch('/:id/agent-status', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  if (user.role !== 'Superadmin' && user.role !== 'Agent Dispatch') {
    return res.status(403).json({
      success: false,
      error: 'Only Superadmin or Agent Dispatch can update Agent Status',
    });
  }

  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);
  if (!wo) {
    return res.status(404).json({ success: false, error: 'Work Order not found' });
  }

  const { status_wo_agent, reason_wo_agent, rootcause_wo_agent, remarks_wo_agent, approve_complete } = req.body;

  const validAgentStatuses = ['Approved', 'Pending', 'Cancel', 'Reschedule', 'Unhandled'];
  if (!validAgentStatuses.includes(status_wo_agent)) {
    return res.status(400).json({
      success: false,
      error: `Invalid Agent Status. Must be one of: ${validAgentStatuses.join(', ')}`,
    });
  }

  const prevAgentStatus = wo.status_wo_agent;
  const prevSystemStatus = wo.system_status;

  wo.status_wo_agent = status_wo_agent;
  wo.date_report_agent = new Date().toISOString();
  if (reason_wo_agent !== undefined) wo.reason_wo_agent = reason_wo_agent;
  if (rootcause_wo_agent !== undefined) wo.rootcause_wo_agent = rootcause_wo_agent;
  if (remarks_wo_agent !== undefined) wo.remarks_wo_agent = remarks_wo_agent;

  // IMPORTANT WORKFLOW RULE:
  // "Jangan menyamakan Approved Agent dengan WO Complete."
  // WO Complete only happens if Dispatch explicitly approves completion!
  if (approve_complete === true && status_wo_agent === 'Approved') {
    wo.system_status = 'Completed';
  } else if (status_wo_agent === 'Pending' || status_wo_agent === 'Reschedule') {
    wo.system_status = 'In Progress';
  }

  wo.updated_at = new Date().toISOString();

  // Create Status History
  const historyEntry: WOStatusHistory = {
    id: crypto.randomUUID(),
    wo_id: wo.id,
    wo_number: wo.wo_number,
    changed_by_user_id: user.id,
    changed_by_name: user.full_name,
    role: user.role,
    previous_agent_status: prevAgentStatus,
    new_agent_status: status_wo_agent,
    previous_system_status: prevSystemStatus,
    new_system_status: wo.system_status,
    reason: reason_wo_agent,
    rootcause: rootcause_wo_agent,
    remarks: remarks_wo_agent,
    created_at: new Date().toISOString(),
  };
  webJawsStore.statusHistory.unshift(historyEntry);

  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: 'UPDATE_WO_AGENT_STATUS',
    module: 'Management WO',
    record_id: wo.wo_number,
    diff_data: { from: prevAgentStatus, to: status_wo_agent, systemStatus: wo.system_status },
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `Agent status updated to ${status_wo_agent}`,
    workOrder: wo,
  });
});

// PATCH /api/work-orders/:id/installer-status - Installer reports progress
woRouter.patch('/:id/installer-status', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);
  if (!wo) {
    return res.status(404).json({ success: false, error: 'Work Order not found' });
  }

  // Installer can only update their own assigned WO
  if (user.role === 'Installer') {
    const isAssigned = wo.assigned_installer_id === user.id ||
      (wo.installer_name && user.full_name && wo.installer_name.toLowerCase().includes(user.full_name.toLowerCase()));
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'Installers can only submit reports for work orders assigned to them',
      });
    }
  }

  const { status_wo_installer, reason_wo_installer, rootcause_wo_installer, remarks_wo_installer } = req.body;

  const validInstallerStatuses = ['Done', 'Pending', 'Reschedule', 'Unhandled'];
  if (!validInstallerStatuses.includes(status_wo_installer)) {
    return res.status(400).json({
      success: false,
      error: `Invalid Installer Status. Must be one of: ${validInstallerStatuses.join(', ')}`,
    });
  }

  const prevInstallerStatus = wo.status_wo_installer;
  const prevSystemStatus = wo.system_status;

  wo.status_wo_installer = status_wo_installer;
  if (!wo.date_report_installer) {
    wo.date_report_installer = new Date().toISOString();
  } else {
    wo.date_report_installer2 = new Date().toISOString();
  }

  if (reason_wo_installer !== undefined) wo.reason_wo_installer = reason_wo_installer;
  if (rootcause_wo_installer !== undefined) wo.rootcause_wo_installer = rootcause_wo_installer;
  if (remarks_wo_installer !== undefined) wo.remarks_wo_installer = remarks_wo_installer;

  // IMPORTANT RULE:
  // "Jangan otomatis menyelesaikan WO hanya karena Installer memilih Done."
  // When Installer sets Done, system_status becomes 'In Progress' awaiting Agent Dispatch review!
  if (wo.system_status === 'Requested' || wo.system_status === 'Assigned') {
    wo.system_status = 'In Progress';
  }

  wo.updated_at = new Date().toISOString();

  // Create Status History
  const historyEntry: WOStatusHistory = {
    id: crypto.randomUUID(),
    wo_id: wo.id,
    wo_number: wo.wo_number,
    changed_by_user_id: user.id,
    changed_by_name: user.full_name,
    role: user.role,
    previous_installer_status: prevInstallerStatus,
    new_installer_status: status_wo_installer,
    previous_system_status: prevSystemStatus,
    new_system_status: wo.system_status,
    reason: reason_wo_installer,
    rootcause: rootcause_wo_installer,
    remarks: remarks_wo_installer,
    created_at: new Date().toISOString(),
  };
  webJawsStore.statusHistory.unshift(historyEntry);

  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: 'UPDATE_WO_INSTALLER_STATUS',
    module: 'Installer',
    record_id: wo.wo_number,
    diff_data: { from: prevInstallerStatus, to: status_wo_installer },
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `Installer status submitted as ${status_wo_installer} (awaiting Dispatch review)`,
    workOrder: wo,
  });
});

// PATCH /api/work-orders/:id/assign - Leader or Dispatch assigns installer & slot
woRouter.patch('/:id/assign', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  if (user.role !== 'Superadmin' && user.role !== 'Agent Dispatch' && user.role !== 'Leader') {
    return res.status(403).json({ success: false, error: 'Unauthorized to assign work orders' });
  }

  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);
  if (!wo) {
    return res.status(404).json({ success: false, error: 'Work Order not found' });
  }

  const { installer_name, assigned_installer_id, slot_time } = req.body;

  if (installer_name !== undefined) wo.installer_name = installer_name;
  if (assigned_installer_id !== undefined) wo.assigned_installer_id = assigned_installer_id;
  if (slot_time !== undefined) wo.slot_time = slot_time;

  wo.date_assign_teknisi = new Date().toISOString();
  if (wo.system_status === 'Requested') {
    wo.system_status = 'Assigned';
  }
  wo.updated_at = new Date().toISOString();

  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: 'ASSIGN_WO_INSTALLER',
    module: 'Distribute WO',
    record_id: wo.wo_number,
    diff_data: { installer: wo.installer_name, slot: wo.slot_time },
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `WO assigned to installer ${wo.installer_name || 'unassigned'}`,
    workOrder: wo,
  });
});
