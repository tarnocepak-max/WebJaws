export type UserRole =
  | 'Superadmin'
  | 'Agent Dispatch'
  | 'Leader'
  | 'Installer'
  | 'Monitoring Data'
  | 'IT Support Application';

export interface StaffUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  contractor_name?: string;
  area?: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export type AgentStatus = 'Approved' | 'Pending' | 'Cancel' | 'Reschedule' | 'Unhandled';
export type InstallerStatus = 'Done' | 'Pending' | 'Reschedule' | 'Unhandled';
export type SystemStatus = 'Requested' | 'Assigned' | 'In Progress' | 'Completed' | 'Archived';

export interface WorkOrder {
  id: string;
  wo_number: string;
  date: string;
  file_name: string;
  date_upload: string;
  date_assign_agent?: string;
  date_assign_teknisi?: string;
  agent_id?: string;
  id_customer?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_phone2?: string;
  customer_phone3?: string;
  contactor_name?: string;
  area?: string;
  installer_name?: string;
  slot_time?: string;
  street_name?: string;
  street_alternatif?: string;
  cluster_name?: string;
  fdt_code?: string;
  fat_code?: string;
  ticket_number?: string;
  ticket_category?: string;
  date_report_agent?: string;
  status_wo_agent: AgentStatus;
  reason_wo_agent?: string;
  rootcause_wo_agent?: string;
  remarks_wo_agent?: string;
  date_report_installer?: string;
  date_report_installer2?: string;
  status_wo_installer: InstallerStatus;
  reason_wo_installer?: string;
  rootcause_wo_installer?: string;
  remarks_wo_installer?: string;
  destination_call?: string;
  reason_call?: string;
  remarks_call?: string;
  agent_ta?: string;
  status_ta?: string;
  remarks_ta?: string;
  flag?: string;
  agent_ret?: string;
  status_ret?: string;
  remarks_ret?: string;
  system_status: SystemStatus;
  assigned_leader_id?: string;
  assigned_installer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WOStatusHistory {
  id: string;
  wo_id: string;
  wo_number: string;
  changed_by_name: string;
  role: string;
  previous_agent_status?: string;
  new_agent_status?: string;
  previous_installer_status?: string;
  new_installer_status?: string;
  previous_system_status?: string;
  new_system_status?: string;
  reason?: string;
  rootcause?: string;
  remarks?: string;
  created_at: string;
}

export interface AppConfig {
  version: number;
  appName: string;
  appTitle: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    darkNavyMode: boolean;
    headerBanner: string;
  };
  sidebar: {
    allowCollapse: boolean;
    defaultExpanded: boolean;
  };
  bottomNav: {
    enabled: boolean;
    items: Array<{ id: string; label: string; path: string; icon: string }>;
  };
  menuCategories: Array<{
    id: string;
    label: string;
    icon: string;
    order: number;
    isActive: boolean;
    allowedRoles: string[];
  }>;
  menuItems: Array<{
    id: string;
    categoryId?: string;
    isStandalone: boolean;
    label: string;
    path: string;
    icon: string;
    order: number;
    isActive: boolean;
    allowedRoles: string[];
    badgeKey?: string;
  }>;
  workflow: {
    installerDoneRequiresDispatchApproval: boolean;
    preventDuplicateWoNumber: boolean;
    autoAssignLeaderByArea: boolean;
  };
  whatsappTemplate: string;
}

export interface DropdownOption {
  id: string;
  category: string;
  label: string;
  value: string;
  order_index: number;
  is_active: boolean;
}

export interface TicketMessage {
  id: string;
  wo_id?: string;
  wo_number?: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  attachment_url?: string;
  attachment_name?: string;
  is_read: boolean;
  created_at: string;
}

export interface DBStatus {
  connected: boolean;
  type: 'supabase_postgres' | 'memory_fallback';
  databaseName?: string;
  serverTime?: string;
  latencyMs?: number;
  error?: string;
  connectionStringMasked?: string;
}
