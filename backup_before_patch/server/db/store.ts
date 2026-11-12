import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, checkConnection } from './db.js';

export interface StaffUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'Superadmin' | 'Agent Dispatch' | 'Leader' | 'Installer' | 'Monitoring Data' | 'IT Support Application';
  contractor_name?: string;
  area?: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  id: string;
  token: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  expires_at: string;
  last_active_at: string;
  created_at: string;
}

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
  status_wo_agent: 'Approved' | 'Pending' | 'Cancel' | 'Reschedule' | 'Unhandled';
  reason_wo_agent?: string;
  rootcause_wo_agent?: string;
  remarks_wo_agent?: string;
  date_report_installer?: string;
  date_report_installer2?: string;
  status_wo_installer: 'Done' | 'Pending' | 'Reschedule' | 'Unhandled';
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
  system_status: 'Requested' | 'Assigned' | 'In Progress' | 'Completed' | 'Archived';
  assigned_leader_id?: string;
  assigned_installer_id?: string;
  import_batch_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WOStatusHistory {
  id: string;
  wo_id: string;
  wo_number: string;
  changed_by_user_id: string;
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

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name: string;
  role: string;
  activity: string;
  module: string;
  record_id?: string;
  diff_data?: any;
  ip_address: string;
  created_at: string;
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

// In-memory synchronized store (acts as instant state layer and fallback when DB is connecting)
export class WebJawsStore {
  users: StaffUser[] = [];
  sessions: AuthSession[] = [];
  loginAttempts: Array<{ identifier: string; ip: string; success: boolean; time: number }> = [];
  workOrders: WorkOrder[] = [];
  statusHistory: WOStatusHistory[] = [];
  dropdowns: DropdownOption[] = [];
  ticketMessages: TicketMessage[] = [];
  auditLogs: AuditLog[] = [];
  configVersions: Array<{
    version_id: string;
    version_number: number;
    title: string;
    config_data: AppConfig;
    change_summary: string;
    created_by_name: string;
    created_at: string;
  }> = [];

  activeConfig: AppConfig;

  constructor() {
    this.activeConfig = this.getDefaultConfig();
    this.seedDefaultData();
  }

  private getDefaultConfig(): AppConfig {
    return {
      version: 1,
      appName: 'WebJaws',
      appTitle: 'Integrated Operations & Ticket Management Platform',
      theme: {
        primaryColor: '#0284c7', // Sky-600
        accentColor: '#38bdf8',  // Sky-400
        darkNavyMode: true,
        headerBanner: 'WebJaws v1.0.0 — Integrated Operations Hub',
      },
      sidebar: {
        allowCollapse: true,
        defaultExpanded: true,
      },
      bottomNav: {
        enabled: true,
        items: [
          { id: 'bn-1', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
          { id: 'bn-2', label: 'Contact Center', path: '/contact-center', icon: 'Headphones' },
          { id: 'bn-3', label: 'Report WO', path: '/report-wo', icon: 'FileSpreadsheet' },
          { id: 'bn-4', label: 'Menu', path: '/menu', icon: 'Menu' },
        ],
      },
      menuCategories: [
        {
          id: 'cat-wo',
          label: 'MANAGEMENT WO',
          icon: 'Layers',
          order: 1,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader', 'Monitoring Data'],
        },
        {
          id: 'cat-installer',
          label: 'INSTALLER',
          icon: 'Wrench',
          order: 2,
          isActive: true,
          allowedRoles: ['Superadmin', 'Installer', 'Leader', 'Agent Dispatch'],
        },
        {
          id: 'cat-setup',
          label: 'SETUP',
          icon: 'Settings',
          order: 3,
          isActive: true,
          allowedRoles: ['Superadmin', 'IT Support Application'],
        },
      ],
      menuItems: [
        // Standalone Top Menus
        {
          id: 'm-dashboard',
          isStandalone: true,
          label: 'Dashboard',
          path: '/dashboard',
          icon: 'LayoutDashboard',
          order: 1,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader', 'Installer', 'Monitoring Data', 'IT Support Application'],
        },
        {
          id: 'm-contact-center',
          isStandalone: true,
          label: 'Contact Center',
          path: '/contact-center',
          icon: 'Headphones',
          order: 2,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader', 'Installer'],
          badgeKey: 'unreadChats',
        },
        {
          id: 'm-report-wo',
          isStandalone: true,
          label: 'Report WO',
          path: '/report-wo',
          icon: 'FileSpreadsheet',
          order: 3,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader', 'Monitoring Data'],
        },
        {
          id: 'm-mgmt-user',
          isStandalone: true,
          label: 'Management User',
          path: '/management-user',
          icon: 'Users',
          order: 4,
          isActive: true,
          allowedRoles: ['Superadmin', 'IT Support Application'],
        },

        // Category 1: MANAGEMENT WO
        {
          id: 'm-import-wo',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'Import WO',
          path: '/management-wo/import-wo',
          icon: 'UploadCloud',
          order: 1,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch'],
        },
        {
          id: 'm-distribute-wo',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'Distribute WO',
          path: '/management-wo/distribute-wo',
          icon: 'Share2',
          order: 2,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader'],
        },
        {
          id: 'm-wo-complete',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'WO Complete',
          path: '/management-wo/wo-complete',
          icon: 'CheckCircle2',
          order: 3,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader', 'Monitoring Data'],
        },
        {
          id: 'm-wo-pending',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'WO Pending',
          path: '/management-wo/wo-pending',
          icon: 'Clock',
          order: 4,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader'],
        },
        {
          id: 'm-wo-reschedule',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'WO Reschedule',
          path: '/management-wo/wo-reschedule',
          icon: 'Calendar',
          order: 5,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader'],
        },
        {
          id: 'm-wo-contractor',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'WO Contractor',
          path: '/management-wo/wo-contractor',
          icon: 'Briefcase',
          order: 6,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader'],
        },
        {
          id: 'm-total-wo',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'TOTAL WO',
          path: '/management-wo/total-wo',
          icon: 'ListFilter',
          order: 7,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Leader', 'Monitoring Data'],
        },
        {
          id: 'm-arsip-wo',
          categoryId: 'cat-wo',
          isStandalone: false,
          label: 'ARSIP WO',
          path: '/management-wo/arsip-wo',
          icon: 'Archive',
          order: 8,
          isActive: true,
          allowedRoles: ['Superadmin', 'Agent Dispatch', 'Monitoring Data'],
        },

        // Category 2: INSTALLER
        {
          id: 'm-installer-dashboard',
          categoryId: 'cat-installer',
          isStandalone: false,
          label: 'Dashboard Installer',
          path: '/installer/dashboard',
          icon: 'Activity',
          order: 1,
          isActive: true,
          allowedRoles: ['Superadmin', 'Installer', 'Leader'],
        },
        {
          id: 'm-installer-tickets',
          categoryId: 'cat-installer',
          isStandalone: false,
          label: 'List Ticket',
          path: '/installer/list-ticket',
          icon: 'FileText',
          order: 2,
          isActive: true,
          allowedRoles: ['Superadmin', 'Installer', 'Leader'],
        },
        {
          id: 'm-installer-contact',
          categoryId: 'cat-installer',
          isStandalone: false,
          label: 'Contact Center',
          path: '/installer/contact-center',
          icon: 'MessageSquare',
          order: 3,
          isActive: true,
          allowedRoles: ['Superadmin', 'Installer', 'Leader'],
        },

        // Category 3: SETUP
        {
          id: 'm-setting-app',
          categoryId: 'cat-setup',
          isStandalone: false,
          label: 'Setting Aplikasi',
          path: '/setup/setting-aplikasi',
          icon: 'Sliders',
          order: 1,
          isActive: true,
          allowedRoles: ['Superadmin', 'IT Support Application'],
        },
        {
          id: 'm-setting-droplist',
          categoryId: 'cat-setup',
          isStandalone: false,
          label: 'Setting Droplist',
          path: '/setup/setting-droplist',
          icon: 'ListOrdered',
          order: 2,
          isActive: true,
          allowedRoles: ['Superadmin'],
        },
        {
          id: 'm-setting-kategori',
          categoryId: 'cat-setup',
          isStandalone: false,
          label: 'Setting Kategori Aplikasi',
          path: '/setup/setting-kategori',
          icon: 'FolderTree',
          order: 3,
          isActive: true,
          allowedRoles: ['Superadmin'],
        },
        {
          id: 'm-database-app',
          categoryId: 'cat-setup',
          isStandalone: false,
          label: 'Database Application',
          path: '/setup/database-application',
          icon: 'Database',
          order: 4,
          isActive: true,
          allowedRoles: ['Superadmin', 'IT Support Application'],
        },
      ],
      workflow: {
        installerDoneRequiresDispatchApproval: true,
        preventDuplicateWoNumber: true,
        autoAssignLeaderByArea: true,
      },
      whatsappTemplate: 'Halo Bpk/Ibu {{customer_name}}, kami dari teknisi {{installer_name}} ({{contractor_name}}) bermaksud konfirmasi kedatangan pemasangan WO {{wo_number}} di {{street_name}} pada slot waktu {{slot_time}}. Terima kasih.',
    };
  }

  private seedDefaultData() {
    // 1. Initial version entry
    this.configVersions.push({
      version_id: crypto.randomUUID(),
      version_number: 1,
      title: 'Initial Enterprise Setup v1.0',
      config_data: this.activeConfig,
      change_summary: 'System baseline initialization with 4 Standalone menus, 3 Accordion Categories, and standard RBAC roles.',
      created_by_name: 'Superadmin WebJaws',
      created_at: new Date().toISOString(),
    });

    // 2. Default Seed Users
    const salt = bcrypt.genSaltSync(10);

    const defaultStaff = [
      {
        id: 'usr-superadmin-01',
        username: 'superadmin',
        email: 'superadmin@webjaws.internal',
        password_hash: bcrypt.hashSync('AdminWebJaws2026!', salt),
        full_name: 'Super Administrator',
        role: 'Superadmin' as const,
        phone: '081234567890',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'usr-agent-01',
        username: 'agent.dispatch',
        email: 'agent.dispatch@webjaws.internal',
        password_hash: bcrypt.hashSync('AgentWebJaws2026!', salt),
        full_name: 'Dewi Sartika (Agent Dispatch)',
        role: 'Agent Dispatch' as const,
        phone: '081234567891',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'usr-leader-01',
        username: 'leader.mora',
        email: 'leader.mora@webjaws.internal',
        password_hash: bcrypt.hashSync('LeaderWebJaws2026!', salt),
        full_name: 'Rian Pratama (Leader)',
        role: 'Leader' as const,
        contractor_name: 'PT Fiber Optik Nusantara',
        area: 'Jakarta Selatan',
        phone: '081234567892',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'usr-installer-01',
        username: 'teknisi.budi',
        email: 'budi.santoso@webjaws.internal',
        password_hash: bcrypt.hashSync('TeknisiWebJaws2026!', salt),
        full_name: 'Budi Santoso (Installer)',
        role: 'Installer' as const,
        contractor_name: 'PT Fiber Optik Nusantara',
        area: 'Jakarta Selatan',
        phone: '081234567893',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'usr-monitor-01',
        username: 'monitoring.staff',
        email: 'monitoring@webjaws.internal',
        password_hash: bcrypt.hashSync('MonitorWebJaws2026!', salt),
        full_name: 'Siti Handayani (Monitoring)',
        role: 'Monitoring Data' as const,
        phone: '081234567894',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'usr-itsupport-01',
        username: 'itsupport.staff',
        email: 'itsupport@webjaws.internal',
        password_hash: bcrypt.hashSync('ITSupportWebJaws2026!', salt),
        full_name: 'Faisal Akbar (IT Support)',
        role: 'IT Support Application' as const,
        phone: '081234567895',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    this.users = defaultStaff;

    // 3. Default Dropdown Options
    const defaultDropdowns: Array<Omit<DropdownOption, 'id'>> = [
      // Status Agent
      { category: 'status_agent', label: 'Approved', value: 'Approved', order_index: 1, is_active: true },
      { category: 'status_agent', label: 'Pending', value: 'Pending', order_index: 2, is_active: true },
      { category: 'status_agent', label: 'Cancel', value: 'Cancel', order_index: 3, is_active: true },
      { category: 'status_agent', label: 'Reschedule', value: 'Reschedule', order_index: 4, is_active: true },
      { category: 'status_agent', label: 'Unhandled', value: 'Unhandled', order_index: 5, is_active: true },

      // Status Installer
      { category: 'status_installer', label: 'Done', value: 'Done', order_index: 1, is_active: true },
      { category: 'status_installer', label: 'Pending', value: 'Pending', order_index: 2, is_active: true },
      { category: 'status_installer', label: 'Reschedule', value: 'Reschedule', order_index: 3, is_active: true },
      { category: 'status_installer', label: 'Unhandled', value: 'Unhandled', order_index: 4, is_active: true },

      // Reason Agent
      { category: 'reason_agent', label: 'Pelanggan Tidak Ada di Tempat', value: 'Pelanggan Tidak Ada di Tempat', order_index: 1, is_active: true },
      { category: 'reason_agent', label: 'Rumah Kosong / Tertutup', value: 'Rumah Kosong / Tertutup', order_index: 2, is_active: true },
      { category: 'reason_agent', label: 'Minta Jadwal Ulang Pelanggan', value: 'Minta Jadwal Ulang Pelanggan', order_index: 3, is_active: true },
      { category: 'reason_agent', label: 'Kendala FAT / OLT Rusak', value: 'Kendala FAT / OLT Rusak', order_index: 4, is_active: true },
      { category: 'reason_agent', label: 'Cuaca Buruk / Hujan Deras', value: 'Cuaca Buruk / Hujan Deras', order_index: 5, is_active: true },

      // Rootcause Agent
      { category: 'rootcause_agent', label: 'Customer Not At Home', value: 'Customer Not At Home', order_index: 1, is_active: true },
      { category: 'rootcause_agent', label: 'Network Fiber Cut', value: 'Network Fiber Cut', order_index: 2, is_active: true },
      { category: 'rootcause_agent', label: 'Port Full on FAT', value: 'Port Full on FAT', order_index: 3, is_active: true },
      { category: 'rootcause_agent', label: 'Customer Reschedule Request', value: 'Customer Reschedule Request', order_index: 4, is_active: true },

      // Contractors
      { category: 'contractor', label: 'PT Fiber Optik Nusantara', value: 'PT Fiber Optik Nusantara', order_index: 1, is_active: true },
      { category: 'contractor', label: 'PT Citra Telekomunikasi', value: 'PT Citra Telekomunikasi', order_index: 2, is_active: true },
      { category: 'contractor', label: 'PT Graha Mitra Data', value: 'PT Graha Mitra Data', order_index: 3, is_active: true },

      // Areas
      { category: 'area', label: 'Jakarta Selatan', value: 'Jakarta Selatan', order_index: 1, is_active: true },
      { category: 'area', label: 'Jakarta Timur', value: 'Jakarta Timur', order_index: 2, is_active: true },
      { category: 'area', label: 'Jakarta Barat', value: 'Jakarta Barat', order_index: 3, is_active: true },
      { category: 'area', label: 'Tangerang Kota', value: 'Tangerang Kota', order_index: 4, is_active: true },
      { category: 'area', label: 'Bekasi Barat', value: 'Bekasi Barat', order_index: 5, is_active: true },

      // Slot Time
      { category: 'slot_time', label: '08:00 - 10:00', value: '08:00 - 10:00', order_index: 1, is_active: true },
      { category: 'slot_time', label: '10:00 - 12:00', value: '10:00 - 12:00', order_index: 2, is_active: true },
      { category: 'slot_time', label: '13:00 - 15:00', value: '13:00 - 15:00', order_index: 3, is_active: true },
      { category: 'slot_time', label: '15:00 - 17:00', value: '15:00 - 17:00', order_index: 4, is_active: true },
      { category: 'slot_time', label: '18:00 - 20:00', value: '18:00 - 20:00', order_index: 5, is_active: true },
    ];

    this.dropdowns = defaultDropdowns.map((d) => ({ ...d, id: crypto.randomUUID() }));

    // 4. Initial Baseline Seed Work Orders (real structured test data for foundation verification)
    const sampleDate = new Date().toISOString().split('T')[0];
    const initialWos: WorkOrder[] = [
      {
        id: 'wo-uuid-001',
        wo_number: 'WO-202611-0081',
        date: sampleDate,
        file_name: 'BATCH_WO_JKT_20261112.xlsx',
        date_upload: new Date().toISOString(),
        date_assign_agent: new Date().toISOString(),
        date_assign_teknisi: new Date().toISOString(),
        agent_id: 'AGT-091',
        id_customer: 'CUST-88910',
        customer_name: 'Alexander Gunawan',
        customer_phone: '081298765432',
        customer_phone2: '081398765433',
        customer_phone3: '',
        contactor_name: 'PT Fiber Optik Nusantara',
        area: 'Jakarta Selatan',
        installer_name: 'Budi Santoso (Installer)',
        slot_time: '08:00 - 10:00',
        street_name: 'Jl. Senopati No. 42 Blok B',
        street_alternatif: 'Gang Melati IV',
        cluster_name: 'Cluster Senopati Indah',
        fdt_code: 'FDT-KBY-01',
        fat_code: 'FAT-KBY-01/08',
        ticket_number: 'TCK-2026-9001',
        ticket_category: 'New Installation',
        date_report_agent: '',
        status_wo_agent: 'Unhandled',
        reason_wo_agent: '',
        rootcause_wo_agent: '',
        remarks_wo_agent: '',
        date_report_installer: '',
        date_report_installer2: '',
        status_wo_installer: 'Unhandled',
        reason_wo_installer: '',
        rootcause_wo_installer: '',
        remarks_wo_installer: '',
        destination_call: 'Customer',
        reason_call: 'Confirmation',
        remarks_call: 'Customer confirmed will be at location',
        agent_ta: 'AGT-091',
        status_ta: 'Verified',
        remarks_ta: 'Ready for technician',
        flag: 'VIP',
        agent_ret: '',
        status_ret: '',
        remarks_ret: '',
        system_status: 'In Progress',
        assigned_leader_id: 'usr-leader-01',
        assigned_installer_id: 'usr-installer-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wo-uuid-002',
        wo_number: 'WO-202611-0082',
        date: sampleDate,
        file_name: 'BATCH_WO_JKT_20261112.xlsx',
        date_upload: new Date().toISOString(),
        date_assign_agent: new Date().toISOString(),
        date_assign_teknisi: new Date().toISOString(),
        agent_id: 'AGT-092',
        id_customer: 'CUST-88911',
        customer_name: 'Maya Indriani',
        customer_phone: '081722334455',
        customer_phone2: '',
        customer_phone3: '',
        contactor_name: 'PT Fiber Optik Nusantara',
        area: 'Jakarta Selatan',
        installer_name: 'Budi Santoso (Installer)',
        slot_time: '10:00 - 12:00',
        street_name: 'Jl. Panglima Polim V No. 12',
        street_alternatif: '',
        cluster_name: 'Polim Residence',
        fdt_code: 'FDT-KBY-02',
        fat_code: 'FAT-KBY-02/03',
        ticket_number: 'TCK-2026-9002',
        ticket_category: 'New Installation',
        date_report_agent: new Date().toISOString(),
        status_wo_agent: 'Approved',
        reason_wo_agent: '',
        rootcause_wo_agent: '',
        remarks_wo_agent: 'Pemasangan berhasil dan sinyal redaman normal -18.2 dBm',
        date_report_installer: new Date().toISOString(),
        date_report_installer2: '',
        status_wo_installer: 'Done',
        reason_wo_installer: '',
        rootcause_wo_installer: '',
        remarks_wo_installer: 'Modem ONT menyala, uji coba speedtest 100 Mbps ok',
        destination_call: '',
        reason_call: '',
        remarks_call: '',
        agent_ta: '',
        status_ta: '',
        remarks_ta: '',
        flag: '',
        agent_ret: '',
        status_ret: '',
        remarks_ret: '',
        system_status: 'Completed',
        assigned_leader_id: 'usr-leader-01',
        assigned_installer_id: 'usr-installer-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wo-uuid-003',
        wo_number: 'WO-202611-0083',
        date: sampleDate,
        file_name: 'BATCH_WO_JKT_20261112.xlsx',
        date_upload: new Date().toISOString(),
        date_assign_agent: new Date().toISOString(),
        date_assign_teknisi: '',
        agent_id: 'AGT-091',
        id_customer: 'CUST-88912',
        customer_name: 'Bambang Sudiro',
        customer_phone: '081900112233',
        customer_phone2: '',
        customer_phone3: '',
        contactor_name: 'PT Citra Telekomunikasi',
        area: 'Jakarta Timur',
        installer_name: '',
        slot_time: '13:00 - 15:00',
        street_name: 'Jl. Rawamangun Muka No. 8',
        street_alternatif: '',
        cluster_name: 'Taman Rawamangun',
        fdt_code: 'FDT-RWM-01',
        fat_code: 'FAT-RWM-01/12',
        ticket_number: 'TCK-2026-9003',
        ticket_category: 'Dismantle / Relocation',
        date_report_agent: '',
        status_wo_agent: 'Pending',
        reason_wo_agent: 'Pelanggan Tidak Ada di Tempat',
        rootcause_wo_agent: 'Customer Not At Home',
        remarks_wo_agent: 'Pelanggan meminta reschedule ke besok pagi',
        date_report_installer: '',
        date_report_installer2: '',
        status_wo_installer: 'Pending',
        reason_wo_installer: 'Pelanggan Tidak Ada di Tempat',
        rootcause_wo_installer: 'Customer Not At Home',
        remarks_wo_installer: 'Menunggu konfirmasi kedatangan besok',
        destination_call: 'Customer',
        reason_call: 'Follow up',
        remarks_call: 'Setuju geser tanggal',
        agent_ta: '',
        status_ta: '',
        remarks_ta: '',
        flag: '',
        agent_ret: '',
        status_ret: '',
        remarks_ret: '',
        system_status: 'Assigned',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wo-uuid-004',
        wo_number: 'WO-202611-0084',
        date: sampleDate,
        file_name: 'BATCH_WO_JKT_20261112.xlsx',
        date_upload: new Date().toISOString(),
        agent_id: 'AGT-093',
        id_customer: 'CUST-88913',
        customer_name: 'Hendrik Pratama',
        customer_phone: '081566778899',
        contactor_name: 'PT Graha Mitra Data',
        area: 'Tangerang Kota',
        installer_name: '',
        slot_time: '15:00 - 17:00',
        street_name: 'Jl. Daan Mogot KM 19 No. 4',
        cluster_name: 'Daan Mogot Permai',
        fdt_code: 'FDT-TGR-03',
        fat_code: 'FAT-TGR-03/05',
        ticket_number: 'TCK-2026-9004',
        ticket_category: 'New Installation',
        status_wo_agent: 'Unhandled',
        status_wo_installer: 'Unhandled',
        system_status: 'Requested',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wo-uuid-005',
        wo_number: 'WO-202611-0085',
        date: sampleDate,
        file_name: 'BATCH_WO_JKT_20261112.xlsx',
        date_upload: new Date().toISOString(),
        agent_id: 'AGT-091',
        id_customer: 'CUST-88914',
        customer_name: 'Citra Kirana',
        customer_phone: '081233445566',
        contactor_name: 'PT Fiber Optik Nusantara',
        area: 'Jakarta Selatan',
        installer_name: '',
        slot_time: '10:00 - 12:00',
        street_name: 'Jl. Cilandak Barat No. 88',
        cluster_name: 'Cilandak Green',
        fdt_code: 'FDT-CLD-01',
        fat_code: 'FAT-CLD-01/02',
        ticket_number: 'TCK-2026-9005',
        ticket_category: 'New Installation',
        status_wo_agent: 'Reschedule',
        reason_wo_agent: 'Minta Jadwal Ulang Pelanggan',
        rootcause_wo_agent: 'Customer Reschedule Request',
        remarks_wo_agent: 'Minta jam siang',
        status_wo_installer: 'Reschedule',
        system_status: 'In Progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wo-uuid-006',
        wo_number: 'WO-202611-0086',
        date: sampleDate,
        file_name: 'BATCH_WO_JKT_20261112.xlsx',
        date_upload: new Date().toISOString(),
        agent_id: 'AGT-092',
        id_customer: 'CUST-88915',
        customer_name: 'Teguh Wicaksono',
        customer_phone: '081377889900',
        contactor_name: 'PT Fiber Optik Nusantara',
        area: 'Jakarta Selatan',
        installer_name: 'Budi Santoso (Installer)',
        slot_time: '13:00 - 15:00',
        street_name: 'Jl. Fatmawati Raya No. 101',
        cluster_name: 'Fatmawati Icon',
        fdt_code: 'FDT-FTM-02',
        fat_code: 'FAT-FTM-02/11',
        ticket_number: 'TCK-2026-9006',
        ticket_category: 'Troubleshooting',
        status_wo_agent: 'Cancel',
        reason_wo_agent: 'Kendala FAT / OLT Rusak',
        rootcause_wo_agent: 'Network Fiber Cut',
        remarks_wo_agent: 'Pemasangan dibatalkan karena kabel backbone putus',
        status_wo_installer: 'Unhandled',
        system_status: 'In Progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];

    this.workOrders = initialWos;

    // 5. Initial Chat Messages
    this.ticketMessages.push({
      id: crypto.randomUUID(),
      wo_id: 'wo-uuid-001',
      wo_number: 'WO-202611-0081',
      sender_id: 'usr-agent-01',
      sender_name: 'Dewi Sartika (Agent Dispatch)',
      sender_role: 'Agent Dispatch',
      message: 'Mas Budi, untuk WO-202611-0081 di Senopati pelanggan sudah standby di rumah. Mohon periksa FAT port 8.',
      is_read: true,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    });

    this.ticketMessages.push({
      id: crypto.randomUUID(),
      wo_id: 'wo-uuid-001',
      wo_number: 'WO-202611-0081',
      sender_id: 'usr-installer-01',
      sender_name: 'Budi Santoso (Installer)',
      sender_role: 'Installer',
      message: 'Siap Bu Dewi, saya sudah di lokasi perumahan. Segera kami tarik dropcore 150m.',
      is_read: false,
      created_at: new Date(Date.now() - 1800000).toISOString(),
    });

    // 6. Initial Audit Log
    this.auditLogs.push({
      id: crypto.randomUUID(),
      user_id: 'usr-superadmin-01',
      user_name: 'Super Administrator',
      role: 'Superadmin',
      activity: 'SYSTEM_INITIALIZATION',
      module: 'Core System',
      ip_address: '127.0.0.1',
      diff_data: { status: 'INITIALIZED', baseline: 'WebJaws Session 1 Foundation' },
      created_at: new Date().toISOString(),
    });
  }

  // --- Login attempts & Rate Limiting ---
  recordLoginAttempt(identifier: string, ip: string, success: boolean) {
    this.loginAttempts.push({
      identifier: identifier.toLowerCase().trim(),
      ip,
      success,
      time: Date.now(),
    });

    // Cleanup old attempts (> 30 mins)
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    this.loginAttempts = this.loginAttempts.filter((a) => a.time > thirtyMinsAgo);
  }

  isRateLimited(identifier: string, ip: string): { limited: boolean; retryAfterSeconds?: number } {
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const key = identifier.toLowerCase().trim();

    const recentFailures = this.loginAttempts.filter(
      (a) => !a.success && (a.identifier === key || a.ip === ip) && a.time > fifteenMinsAgo
    );

    // Limit to 5 failed attempts per 15 mins
    if (recentFailures.length >= 5) {
      const oldestRelevant = recentFailures[0].time;
      const unlockTime = oldestRelevant + 15 * 60 * 1000;
      const waitSec = Math.max(1, Math.ceil((unlockTime - Date.now()) / 1000));
      return { limited: true, retryAfterSeconds: waitSec };
    }

    return { limited: false };
  }

  // --- Session Management ---
  createSession(userId: string, ip: string, userAgent: string, durationHours = 24): AuthSession {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    const session: AuthSession = {
      id: crypto.randomUUID(),
      token,
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    this.sessions.push(session);
    return session;
  }

  findSession(token: string): AuthSession | null {
    if (!token) return null;
    const session = this.sessions.find((s) => s.token === token);
    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      this.revokeSession(token);
      return null;
    }

    session.last_active_at = new Date().toISOString();
    return session;
  }

  revokeSession(token: string) {
    this.sessions = this.sessions.filter((s) => s.token !== token);
  }

  revokeUserSessions(userId: string) {
    this.sessions = this.sessions.filter((s) => s.user_id !== userId);
  }

  // --- Audit Logging ---
  addAuditLog(entry: Omit<AuditLog, 'id' | 'created_at'>) {
    const log: AuditLog = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    // Keep max 1000 in memory
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(0, 1000);
    }
  }
}

export const webJawsStore = new WebJawsStore();
