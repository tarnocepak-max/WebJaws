import { StaffUser, AppConfig, WorkOrder, DropdownOption, TicketMessage, DBStatus } from '../types';

// Authentication is cookie-only. The HttpOnly session cookie is managed by the browser.
export function setToken(_token: string | null) { /* intentionally disabled */ }
export function getToken(): null { return null; }

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');


  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Include HttpOnly cookies
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (identifier: string, password: string) =>
    apiFetch<{ success: boolean; user: StaffUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  logout: () =>
    apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  getMe: () =>
    apiFetch<{ success: boolean; user: StaffUser; appConfig: AppConfig }>('/api/auth/me'),

  // Users (Superadmin)
  getUsers: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch<{ success: boolean; total: number; users: StaffUser[] }>(`/api/users${qs ? '?' + qs : ''}`);
  },
  createUser: (data: any) =>
    apiFetch<{ success: boolean; user: StaffUser }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: any) =>
    apiFetch<{ success: boolean; user: StaffUser }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  toggleUserStatus: (id: string, is_active: boolean) =>
    apiFetch<{ success: boolean; is_active: boolean }>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    }),
  resetUserPassword: (id: string, new_password: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    }),

  // Centralized Configuration
  getConfig: () => apiFetch<{ success: boolean; config: AppConfig }>('/api/config'),
  saveConfig: (newConfig: AppConfig, changeSummary: string, title?: string) =>
    apiFetch<{ success: boolean; config: AppConfig }>('/api/config', {
      method: 'POST',
      body: JSON.stringify({ newConfig, changeSummary, title }),
    }),
  getConfigVersions: () =>
    apiFetch<{ success: boolean; versions: any[] }>('/api/config/versions'),
  rollbackConfig: (versionNumber: number) =>
    apiFetch<{ success: boolean; message: string; config: AppConfig }>(`/api/config/rollback/${versionNumber}`, {
      method: 'POST',
    }),
  getDroplists: (category?: string) =>
    apiFetch<{ success: boolean; droplists: DropdownOption[] }>(
      `/api/config/droplists${category ? '?category=' + category : ''}`
    ),
  addDroplist: (data: { category: string; label: string; value: string; order_index?: number }) =>
    apiFetch<{ success: boolean; item: DropdownOption }>('/api/config/droplists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDroplist: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/config/droplists/${id}`, { method: 'DELETE' }),

  // Work Orders & Metrics
  getWorkOrders: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch<{ success: boolean; total: number; totalPages: number; workOrders: WorkOrder[] }>(
      `/api/work-orders${qs ? '?' + qs : ''}`
    );
  },
  getWOStats: () =>
    apiFetch<{
      success: boolean;
      stats: {
        woRequested: number;
        totalWO: number;
        cancelCount: number;
        pendingCount: number;
        rescheduleCount: number;
        approvedAgent: number;
        unhandledAgent: number;
        unhandledInstaller: number;
        breakdown: {
          byContractor: Record<string, number>;
          byArea: Record<string, number>;
          byInstaller: Record<string, number>;
        };
      };
    }>('/api/work-orders/stats'),
  getWODetail: (id: string) =>
    apiFetch<{ success: boolean; workOrder: WorkOrder; statusHistory: any[] }>(`/api/work-orders/${id}`),
  updateAgentStatus: (
    id: string,
    data: {
      status_wo_agent: string;
      reason_wo_agent?: string;
      rootcause_wo_agent?: string;
      remarks_wo_agent?: string;
      approve_complete?: boolean;
    }
  ) =>
    apiFetch<{ success: boolean; workOrder: WorkOrder }>(`/api/work-orders/${id}/agent-status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateInstallerStatus: (
    id: string,
    data: {
      status_wo_installer: string;
      reason_wo_installer?: string;
      rootcause_wo_installer?: string;
      remarks_wo_installer?: string;
    }
  ) =>
    apiFetch<{ success: boolean; workOrder: WorkOrder }>(`/api/work-orders/${id}/installer-status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  assignWO: (id: string, data: { installer_name?: string; slot_time?: string }) =>
    apiFetch<{ success: boolean; workOrder: WorkOrder }>(`/api/work-orders/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Import WO & Text-to-Table
  previewImport: (payload: { rawText?: string; method: string; fileName?: string; base64Data?: string; manualDelimiter?: string }) =>
    apiFetch<{
      success: boolean;
      summary: any;
      headerMapping: Record<string, string>;
      previewRows: any[];
      rowErrors: any[];
      allValidRows: any[];
    }>('/api/import/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirmImport: (validRows: any[], fileName: string, importMethod: string) =>
    apiFetch<{ success: boolean; message: string; batchId: string; insertedCount: number; skippedCount: number }>(
      '/api/import/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ validRows, fileName, importMethod }),
      }
    ),

  // Contact Center & LiveChat
  getContactMessages: (wo_number?: string, unread_only = false) =>
    apiFetch<{ success: boolean; total: number; unreadCount: number; threads: any[]; messages: TicketMessage[] }>(
      `/api/contact/messages?${wo_number ? 'wo_number=' + encodeURIComponent(wo_number) + '&' : ''}unread_only=${unread_only}`
    ),
  sendContactMessage: (data: { wo_number?: string; message: string; attachment_url?: string; attachment_name?: string }) =>
    apiFetch<{ success: boolean; chatMessage: TicketMessage }>('/api/contact/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  markMessageRead: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/contact/messages/${id}/read`, { method: 'PATCH' }),

  // System & Health
  getHealth: () =>
    apiFetch<{
      success: boolean;
      status: string;
      platform: string;
      uptimeSeconds: number;
      database: DBStatus;
      stats: any;
    }>('/api/system/health'),
  runMigration: () =>
    apiFetch<{ success: boolean; result: any }>('/api/system/migrate', { method: 'POST' }),
  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch<{ success: boolean; total: number; logs: any[] }>(`/api/system/audit-logs${qs ? '?' + qs : ''}`);
  },
};
