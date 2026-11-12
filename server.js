// server.ts
import express from "express";
import cookieParser from "cookie-parser";
import dotenv2 from "dotenv";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// server/routes/authRoutes.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";

// server/db/db.ts
import fs from "fs";
import cp from "child_process";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ override: true });
var { Pool } = pg;
var databaseUrl = process.env.DATABASE_URL || "";
var pool = null;
var hasPlaceholder = !databaseUrl || /(PROJECT_REF|DB_PASSWORD|@HOST[:/]|your-db-password|your-supabase-ref|\[YOUR-PASSWORD\]|change-me)/i.test(databaseUrl);
var isLocal = /localhost|127\.0\.0\.1|host=\/tmp/i.test(databaseUrl);
if (databaseUrl.trim() && !hasPlaceholder) {
  if (isLocal) {
    try {
      const possibleDirs = [
        "/app/applet/data/pgdata",
        "./data/pgdata",
        "/app/applet/data/postgres",
        "./data/postgres"
      ];
      for (const dir of possibleDirs) {
        if (fs.existsSync(`${dir}/PG_VERSION`) && fs.existsSync(`${dir}/postgresql.conf`)) {
          try {
            cp.execSync(
              `su -s /bin/bash appuser -c "/usr/lib/postgresql/15/bin/pg_ctl -D ${dir} status >/dev/null 2>&1 || /usr/lib/postgresql/15/bin/pg_ctl -D ${dir} -o '-k /tmp -p 5432' start >/dev/null 2>&1"`,
              { timeout: 3e3 }
            );
            break;
          } catch {
          }
        }
      }
    } catch {
    }
  }
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 5e3
  });
  pool.on("error", (err) => console.error("Unexpected PostgreSQL pool error:", err.message));
}
function maskConnectionString(str) {
  if (!str) return "Not Configured";
  return str.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/i, "$1********$2");
}
async function checkConnection() {
  if (!pool) {
    return {
      connected: false,
      type: "unavailable",
      connectionStringMasked: maskConnectionString(databaseUrl),
      error: !databaseUrl ? "DATABASE_URL is not configured" : "DATABASE_URL contains placeholder values or could not initialize the pool"
    };
  }
  const start = Date.now();
  try {
    const result = await pool.query("SELECT current_database() AS db_name, NOW() AS current_time");
    return {
      connected: true,
      type: "supabase_postgres",
      databaseName: result.rows[0]?.db_name || "postgres",
      serverTime: result.rows[0]?.current_time,
      latencyMs: Date.now() - start,
      connectionStringMasked: maskConnectionString(databaseUrl)
    };
  } catch (error) {
    return {
      connected: false,
      type: "unavailable",
      connectionStringMasked: maskConnectionString(databaseUrl),
      error: `PostgreSQL connection failed: ${error.message}`
    };
  }
}
async function query(sql, params) {
  if (!pool) throw new Error("PostgreSQL is unavailable. Configure DATABASE_URL before using persistent features.");
  return pool.query(sql, params);
}

// server/db/store.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
var WebJawsStore = class {
  constructor() {
    this.users = [];
    this.sessions = [];
    this.loginAttempts = [];
    this.workOrders = [];
    this.statusHistory = [];
    this.dropdowns = [];
    this.ticketMessages = [];
    this.auditLogs = [];
    this.configVersions = [];
    this.activeConfig = this.getDefaultConfig();
    this.seedDefaultData();
  }
  getDefaultConfig() {
    return {
      version: 1,
      appName: "WebJaws",
      appTitle: "Integrated Operations & Ticket Management Platform",
      theme: {
        primaryColor: "#0284c7",
        // Sky-600
        accentColor: "#38bdf8",
        // Sky-400
        darkNavyMode: true,
        headerBanner: "WebJaws v1.0.0 \u2014 Integrated Operations Hub"
      },
      sidebar: {
        allowCollapse: true,
        defaultExpanded: true
      },
      bottomNav: {
        enabled: true,
        items: [
          { id: "bn-1", label: "Dashboard", path: "/dashboard", icon: "LayoutDashboard" },
          { id: "bn-2", label: "Contact Center", path: "/contact-center", icon: "Headphones" },
          { id: "bn-3", label: "Report WO", path: "/report-wo", icon: "FileSpreadsheet" },
          { id: "bn-4", label: "Menu", path: "/menu", icon: "Menu" }
        ]
      },
      menuCategories: [
        {
          id: "cat-wo",
          label: "MANAGEMENT WO",
          icon: "Layers",
          order: 1,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader", "Monitoring Data"]
        },
        {
          id: "cat-installer",
          label: "INSTALLER",
          icon: "Wrench",
          order: 2,
          isActive: true,
          allowedRoles: ["Superadmin", "Installer", "Leader", "Agent Dispatch"]
        },
        {
          id: "cat-setup",
          label: "SETUP",
          icon: "Settings",
          order: 3,
          isActive: true,
          allowedRoles: ["Superadmin", "IT Support Application"]
        }
      ],
      menuItems: [
        // Standalone Top Menus
        {
          id: "m-dashboard",
          isStandalone: true,
          label: "Dashboard",
          path: "/dashboard",
          icon: "LayoutDashboard",
          order: 1,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader", "Installer", "Monitoring Data", "IT Support Application"]
        },
        {
          id: "m-contact-center",
          isStandalone: true,
          label: "Contact Center",
          path: "/contact-center",
          icon: "Headphones",
          order: 2,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader", "Installer"],
          badgeKey: "unreadChats"
        },
        {
          id: "m-report-wo",
          isStandalone: true,
          label: "Report WO",
          path: "/report-wo",
          icon: "FileSpreadsheet",
          order: 3,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader", "Monitoring Data"]
        },
        {
          id: "m-mgmt-user",
          isStandalone: true,
          label: "Management User",
          path: "/management-user",
          icon: "Users",
          order: 4,
          isActive: true,
          allowedRoles: ["Superadmin", "IT Support Application"]
        },
        // Category 1: MANAGEMENT WO
        {
          id: "m-import-wo",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "Import WO",
          path: "/management-wo/import-wo",
          icon: "UploadCloud",
          order: 1,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch"]
        },
        {
          id: "m-distribute-wo",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "Distribute WO",
          path: "/management-wo/distribute-wo",
          icon: "Share2",
          order: 2,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader"]
        },
        {
          id: "m-wo-complete",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "WO Complete",
          path: "/management-wo/wo-complete",
          icon: "CheckCircle2",
          order: 3,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader", "Monitoring Data"]
        },
        {
          id: "m-wo-pending",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "WO Pending",
          path: "/management-wo/wo-pending",
          icon: "Clock",
          order: 4,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader"]
        },
        {
          id: "m-wo-reschedule",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "WO Reschedule",
          path: "/management-wo/wo-reschedule",
          icon: "Calendar",
          order: 5,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader"]
        },
        {
          id: "m-wo-contractor",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "WO Contractor",
          path: "/management-wo/wo-contractor",
          icon: "Briefcase",
          order: 6,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader"]
        },
        {
          id: "m-total-wo",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "TOTAL WO",
          path: "/management-wo/total-wo",
          icon: "ListFilter",
          order: 7,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Leader", "Monitoring Data"]
        },
        {
          id: "m-arsip-wo",
          categoryId: "cat-wo",
          isStandalone: false,
          label: "ARSIP WO",
          path: "/management-wo/arsip-wo",
          icon: "Archive",
          order: 8,
          isActive: true,
          allowedRoles: ["Superadmin", "Agent Dispatch", "Monitoring Data"]
        },
        // Category 2: INSTALLER
        {
          id: "m-installer-dashboard",
          categoryId: "cat-installer",
          isStandalone: false,
          label: "Dashboard Installer",
          path: "/installer/dashboard",
          icon: "Activity",
          order: 1,
          isActive: true,
          allowedRoles: ["Superadmin", "Installer", "Leader"]
        },
        {
          id: "m-installer-tickets",
          categoryId: "cat-installer",
          isStandalone: false,
          label: "List Ticket",
          path: "/installer/list-ticket",
          icon: "FileText",
          order: 2,
          isActive: true,
          allowedRoles: ["Superadmin", "Installer", "Leader"]
        },
        {
          id: "m-installer-contact",
          categoryId: "cat-installer",
          isStandalone: false,
          label: "Contact Center",
          path: "/installer/contact-center",
          icon: "MessageSquare",
          order: 3,
          isActive: true,
          allowedRoles: ["Superadmin", "Installer", "Leader"]
        },
        // Category 3: SETUP
        {
          id: "m-setting-app",
          categoryId: "cat-setup",
          isStandalone: false,
          label: "Setting Aplikasi",
          path: "/setup/setting-aplikasi",
          icon: "Sliders",
          order: 1,
          isActive: true,
          allowedRoles: ["Superadmin", "IT Support Application"]
        },
        {
          id: "m-setting-droplist",
          categoryId: "cat-setup",
          isStandalone: false,
          label: "Setting Droplist",
          path: "/setup/setting-droplist",
          icon: "ListOrdered",
          order: 2,
          isActive: true,
          allowedRoles: ["Superadmin"]
        },
        {
          id: "m-setting-kategori",
          categoryId: "cat-setup",
          isStandalone: false,
          label: "Setting Kategori Aplikasi",
          path: "/setup/setting-kategori",
          icon: "FolderTree",
          order: 3,
          isActive: true,
          allowedRoles: ["Superadmin"]
        },
        {
          id: "m-database-app",
          categoryId: "cat-setup",
          isStandalone: false,
          label: "Database Application",
          path: "/setup/database-application",
          icon: "Database",
          order: 4,
          isActive: true,
          allowedRoles: ["Superadmin", "IT Support Application"]
        }
      ],
      workflow: {
        installerDoneRequiresDispatchApproval: true,
        preventDuplicateWoNumber: true,
        autoAssignLeaderByArea: true
      },
      whatsappTemplate: "Halo Bpk/Ibu {{customer_name}}, kami dari teknisi {{installer_name}} ({{contractor_name}}) bermaksud konfirmasi kedatangan pemasangan WO {{wo_number}} di {{street_name}} pada slot waktu {{slot_time}}. Terima kasih."
    };
  }
  seedDefaultData() {
    this.configVersions.push({
      version_id: crypto.randomUUID(),
      version_number: 1,
      title: "Initial Enterprise Setup v1.0",
      config_data: this.activeConfig,
      change_summary: "System baseline initialization with 4 Standalone menus, 3 Accordion Categories, and standard RBAC roles.",
      created_by_name: "Superadmin WebJaws",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    const salt = bcrypt.genSaltSync(10);
    const defaultStaff = [
      {
        id: "usr-superadmin-01",
        username: "superadmin",
        email: "superadmin@webjaws.internal",
        password_hash: bcrypt.hashSync("AdminWebJaws2026!", salt),
        full_name: "Super Administrator",
        role: "Superadmin",
        phone: "081234567890",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "usr-admin-demo",
        username: "admin",
        email: "adminjaws@mora.jaws",
        password_hash: bcrypt.hashSync("1234", salt),
        full_name: "WebJaws Demo Admin",
        role: "Superadmin",
        phone: "081234567899",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "usr-agent-01",
        username: "agent.dispatch",
        email: "agent.dispatch@webjaws.internal",
        password_hash: bcrypt.hashSync("AgentWebJaws2026!", salt),
        full_name: "Dewi Sartika (Agent Dispatch)",
        role: "Agent Dispatch",
        phone: "081234567891",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "usr-leader-01",
        username: "leader.mora",
        email: "leader.mora@webjaws.internal",
        password_hash: bcrypt.hashSync("LeaderWebJaws2026!", salt),
        full_name: "Rian Pratama (Leader)",
        role: "Leader",
        contractor_name: "PT Fiber Optik Nusantara",
        area: "Jakarta Selatan",
        phone: "081234567892",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "usr-installer-01",
        username: "teknisi.budi",
        email: "budi.santoso@webjaws.internal",
        password_hash: bcrypt.hashSync("TeknisiWebJaws2026!", salt),
        full_name: "Budi Santoso (Installer)",
        role: "Installer",
        contractor_name: "PT Fiber Optik Nusantara",
        area: "Jakarta Selatan",
        phone: "081234567893",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "usr-monitor-01",
        username: "monitoring.staff",
        email: "monitoring@webjaws.internal",
        password_hash: bcrypt.hashSync("MonitorWebJaws2026!", salt),
        full_name: "Siti Handayani (Monitoring)",
        role: "Monitoring Data",
        phone: "081234567894",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "usr-itsupport-01",
        username: "itsupport.staff",
        email: "itsupport@webjaws.internal",
        password_hash: bcrypt.hashSync("ITSupportWebJaws2026!", salt),
        full_name: "Faisal Akbar (IT Support)",
        role: "IT Support Application",
        phone: "081234567895",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    this.users = defaultStaff;
    const defaultDropdowns = [
      // Status Agent
      { category: "status_agent", label: "Approved", value: "Approved", order_index: 1, is_active: true },
      { category: "status_agent", label: "Pending", value: "Pending", order_index: 2, is_active: true },
      { category: "status_agent", label: "Cancel", value: "Cancel", order_index: 3, is_active: true },
      { category: "status_agent", label: "Reschedule", value: "Reschedule", order_index: 4, is_active: true },
      { category: "status_agent", label: "Unhandled", value: "Unhandled", order_index: 5, is_active: true },
      // Status Installer
      { category: "status_installer", label: "Done", value: "Done", order_index: 1, is_active: true },
      { category: "status_installer", label: "Pending", value: "Pending", order_index: 2, is_active: true },
      { category: "status_installer", label: "Reschedule", value: "Reschedule", order_index: 3, is_active: true },
      { category: "status_installer", label: "Unhandled", value: "Unhandled", order_index: 4, is_active: true },
      // Reason Agent
      { category: "reason_agent", label: "Pelanggan Tidak Ada di Tempat", value: "Pelanggan Tidak Ada di Tempat", order_index: 1, is_active: true },
      { category: "reason_agent", label: "Rumah Kosong / Tertutup", value: "Rumah Kosong / Tertutup", order_index: 2, is_active: true },
      { category: "reason_agent", label: "Minta Jadwal Ulang Pelanggan", value: "Minta Jadwal Ulang Pelanggan", order_index: 3, is_active: true },
      { category: "reason_agent", label: "Kendala FAT / OLT Rusak", value: "Kendala FAT / OLT Rusak", order_index: 4, is_active: true },
      { category: "reason_agent", label: "Cuaca Buruk / Hujan Deras", value: "Cuaca Buruk / Hujan Deras", order_index: 5, is_active: true },
      // Rootcause Agent
      { category: "rootcause_agent", label: "Customer Not At Home", value: "Customer Not At Home", order_index: 1, is_active: true },
      { category: "rootcause_agent", label: "Network Fiber Cut", value: "Network Fiber Cut", order_index: 2, is_active: true },
      { category: "rootcause_agent", label: "Port Full on FAT", value: "Port Full on FAT", order_index: 3, is_active: true },
      { category: "rootcause_agent", label: "Customer Reschedule Request", value: "Customer Reschedule Request", order_index: 4, is_active: true },
      // Contractors
      { category: "contractor", label: "PT Fiber Optik Nusantara", value: "PT Fiber Optik Nusantara", order_index: 1, is_active: true },
      { category: "contractor", label: "PT Citra Telekomunikasi", value: "PT Citra Telekomunikasi", order_index: 2, is_active: true },
      { category: "contractor", label: "PT Graha Mitra Data", value: "PT Graha Mitra Data", order_index: 3, is_active: true },
      // Areas
      { category: "area", label: "Jakarta Selatan", value: "Jakarta Selatan", order_index: 1, is_active: true },
      { category: "area", label: "Jakarta Timur", value: "Jakarta Timur", order_index: 2, is_active: true },
      { category: "area", label: "Jakarta Barat", value: "Jakarta Barat", order_index: 3, is_active: true },
      { category: "area", label: "Tangerang Kota", value: "Tangerang Kota", order_index: 4, is_active: true },
      { category: "area", label: "Bekasi Barat", value: "Bekasi Barat", order_index: 5, is_active: true },
      // Slot Time
      { category: "slot_time", label: "08:00 - 10:00", value: "08:00 - 10:00", order_index: 1, is_active: true },
      { category: "slot_time", label: "10:00 - 12:00", value: "10:00 - 12:00", order_index: 2, is_active: true },
      { category: "slot_time", label: "13:00 - 15:00", value: "13:00 - 15:00", order_index: 3, is_active: true },
      { category: "slot_time", label: "15:00 - 17:00", value: "15:00 - 17:00", order_index: 4, is_active: true },
      { category: "slot_time", label: "18:00 - 20:00", value: "18:00 - 20:00", order_index: 5, is_active: true }
    ];
    this.dropdowns = defaultDropdowns.map((d) => ({ ...d, id: crypto.randomUUID() }));
    const sampleDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const initialWos = [
      {
        id: "wo-uuid-001",
        wo_number: "WO-202611-0081",
        date: sampleDate,
        file_name: "BATCH_WO_JKT_20261112.xlsx",
        date_upload: (/* @__PURE__ */ new Date()).toISOString(),
        date_assign_agent: (/* @__PURE__ */ new Date()).toISOString(),
        date_assign_teknisi: (/* @__PURE__ */ new Date()).toISOString(),
        agent_id: "AGT-091",
        id_customer: "CUST-88910",
        customer_name: "Alexander Gunawan",
        customer_phone: "081298765432",
        customer_phone2: "081398765433",
        customer_phone3: "",
        contactor_name: "PT Fiber Optik Nusantara",
        area: "Jakarta Selatan",
        installer_name: "Budi Santoso (Installer)",
        slot_time: "08:00 - 10:00",
        street_name: "Jl. Senopati No. 42 Blok B",
        street_alternatif: "Gang Melati IV",
        cluster_name: "Cluster Senopati Indah",
        fdt_code: "FDT-KBY-01",
        fat_code: "FAT-KBY-01/08",
        ticket_number: "TCK-2026-9001",
        ticket_category: "New Installation",
        date_report_agent: "",
        status_wo_agent: "Unhandled",
        reason_wo_agent: "",
        rootcause_wo_agent: "",
        remarks_wo_agent: "",
        date_report_installer: "",
        date_report_installer2: "",
        status_wo_installer: "Unhandled",
        reason_wo_installer: "",
        rootcause_wo_installer: "",
        remarks_wo_installer: "",
        destination_call: "Customer",
        reason_call: "Confirmation",
        remarks_call: "Customer confirmed will be at location",
        agent_ta: "AGT-091",
        status_ta: "Verified",
        remarks_ta: "Ready for technician",
        flag: "VIP",
        agent_ret: "",
        status_ret: "",
        remarks_ret: "",
        system_status: "In Progress",
        assigned_leader_id: "usr-leader-01",
        assigned_installer_id: "usr-installer-01",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "wo-uuid-002",
        wo_number: "WO-202611-0082",
        date: sampleDate,
        file_name: "BATCH_WO_JKT_20261112.xlsx",
        date_upload: (/* @__PURE__ */ new Date()).toISOString(),
        date_assign_agent: (/* @__PURE__ */ new Date()).toISOString(),
        date_assign_teknisi: (/* @__PURE__ */ new Date()).toISOString(),
        agent_id: "AGT-092",
        id_customer: "CUST-88911",
        customer_name: "Maya Indriani",
        customer_phone: "081722334455",
        customer_phone2: "",
        customer_phone3: "",
        contactor_name: "PT Fiber Optik Nusantara",
        area: "Jakarta Selatan",
        installer_name: "Budi Santoso (Installer)",
        slot_time: "10:00 - 12:00",
        street_name: "Jl. Panglima Polim V No. 12",
        street_alternatif: "",
        cluster_name: "Polim Residence",
        fdt_code: "FDT-KBY-02",
        fat_code: "FAT-KBY-02/03",
        ticket_number: "TCK-2026-9002",
        ticket_category: "New Installation",
        date_report_agent: (/* @__PURE__ */ new Date()).toISOString(),
        status_wo_agent: "Approved",
        reason_wo_agent: "",
        rootcause_wo_agent: "",
        remarks_wo_agent: "Pemasangan berhasil dan sinyal redaman normal -18.2 dBm",
        date_report_installer: (/* @__PURE__ */ new Date()).toISOString(),
        date_report_installer2: "",
        status_wo_installer: "Done",
        reason_wo_installer: "",
        rootcause_wo_installer: "",
        remarks_wo_installer: "Modem ONT menyala, uji coba speedtest 100 Mbps ok",
        destination_call: "",
        reason_call: "",
        remarks_call: "",
        agent_ta: "",
        status_ta: "",
        remarks_ta: "",
        flag: "",
        agent_ret: "",
        status_ret: "",
        remarks_ret: "",
        system_status: "Completed",
        assigned_leader_id: "usr-leader-01",
        assigned_installer_id: "usr-installer-01",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "wo-uuid-003",
        wo_number: "WO-202611-0083",
        date: sampleDate,
        file_name: "BATCH_WO_JKT_20261112.xlsx",
        date_upload: (/* @__PURE__ */ new Date()).toISOString(),
        date_assign_agent: (/* @__PURE__ */ new Date()).toISOString(),
        date_assign_teknisi: "",
        agent_id: "AGT-091",
        id_customer: "CUST-88912",
        customer_name: "Bambang Sudiro",
        customer_phone: "081900112233",
        customer_phone2: "",
        customer_phone3: "",
        contactor_name: "PT Citra Telekomunikasi",
        area: "Jakarta Timur",
        installer_name: "",
        slot_time: "13:00 - 15:00",
        street_name: "Jl. Rawamangun Muka No. 8",
        street_alternatif: "",
        cluster_name: "Taman Rawamangun",
        fdt_code: "FDT-RWM-01",
        fat_code: "FAT-RWM-01/12",
        ticket_number: "TCK-2026-9003",
        ticket_category: "Dismantle / Relocation",
        date_report_agent: "",
        status_wo_agent: "Pending",
        reason_wo_agent: "Pelanggan Tidak Ada di Tempat",
        rootcause_wo_agent: "Customer Not At Home",
        remarks_wo_agent: "Pelanggan meminta reschedule ke besok pagi",
        date_report_installer: "",
        date_report_installer2: "",
        status_wo_installer: "Pending",
        reason_wo_installer: "Pelanggan Tidak Ada di Tempat",
        rootcause_wo_installer: "Customer Not At Home",
        remarks_wo_installer: "Menunggu konfirmasi kedatangan besok",
        destination_call: "Customer",
        reason_call: "Follow up",
        remarks_call: "Setuju geser tanggal",
        agent_ta: "",
        status_ta: "",
        remarks_ta: "",
        flag: "",
        agent_ret: "",
        status_ret: "",
        remarks_ret: "",
        system_status: "Assigned",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "wo-uuid-004",
        wo_number: "WO-202611-0084",
        date: sampleDate,
        file_name: "BATCH_WO_JKT_20261112.xlsx",
        date_upload: (/* @__PURE__ */ new Date()).toISOString(),
        agent_id: "AGT-093",
        id_customer: "CUST-88913",
        customer_name: "Hendrik Pratama",
        customer_phone: "081566778899",
        contactor_name: "PT Graha Mitra Data",
        area: "Tangerang Kota",
        installer_name: "",
        slot_time: "15:00 - 17:00",
        street_name: "Jl. Daan Mogot KM 19 No. 4",
        cluster_name: "Daan Mogot Permai",
        fdt_code: "FDT-TGR-03",
        fat_code: "FAT-TGR-03/05",
        ticket_number: "TCK-2026-9004",
        ticket_category: "New Installation",
        status_wo_agent: "Unhandled",
        status_wo_installer: "Unhandled",
        system_status: "Requested",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "wo-uuid-005",
        wo_number: "WO-202611-0085",
        date: sampleDate,
        file_name: "BATCH_WO_JKT_20261112.xlsx",
        date_upload: (/* @__PURE__ */ new Date()).toISOString(),
        agent_id: "AGT-091",
        id_customer: "CUST-88914",
        customer_name: "Citra Kirana",
        customer_phone: "081233445566",
        contactor_name: "PT Fiber Optik Nusantara",
        area: "Jakarta Selatan",
        installer_name: "",
        slot_time: "10:00 - 12:00",
        street_name: "Jl. Cilandak Barat No. 88",
        cluster_name: "Cilandak Green",
        fdt_code: "FDT-CLD-01",
        fat_code: "FAT-CLD-01/02",
        ticket_number: "TCK-2026-9005",
        ticket_category: "New Installation",
        status_wo_agent: "Reschedule",
        reason_wo_agent: "Minta Jadwal Ulang Pelanggan",
        rootcause_wo_agent: "Customer Reschedule Request",
        remarks_wo_agent: "Minta jam siang",
        status_wo_installer: "Reschedule",
        system_status: "In Progress",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "wo-uuid-006",
        wo_number: "WO-202611-0086",
        date: sampleDate,
        file_name: "BATCH_WO_JKT_20261112.xlsx",
        date_upload: (/* @__PURE__ */ new Date()).toISOString(),
        agent_id: "AGT-092",
        id_customer: "CUST-88915",
        customer_name: "Teguh Wicaksono",
        customer_phone: "081377889900",
        contactor_name: "PT Fiber Optik Nusantara",
        area: "Jakarta Selatan",
        installer_name: "Budi Santoso (Installer)",
        slot_time: "13:00 - 15:00",
        street_name: "Jl. Fatmawati Raya No. 101",
        cluster_name: "Fatmawati Icon",
        fdt_code: "FDT-FTM-02",
        fat_code: "FAT-FTM-02/11",
        ticket_number: "TCK-2026-9006",
        ticket_category: "Troubleshooting",
        status_wo_agent: "Cancel",
        reason_wo_agent: "Kendala FAT / OLT Rusak",
        rootcause_wo_agent: "Network Fiber Cut",
        remarks_wo_agent: "Pemasangan dibatalkan karena kabel backbone putus",
        status_wo_installer: "Unhandled",
        system_status: "In Progress",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    this.workOrders = initialWos;
    this.ticketMessages.push({
      id: crypto.randomUUID(),
      wo_id: "wo-uuid-001",
      wo_number: "WO-202611-0081",
      sender_id: "usr-agent-01",
      sender_name: "Dewi Sartika (Agent Dispatch)",
      sender_role: "Agent Dispatch",
      message: "Mas Budi, untuk WO-202611-0081 di Senopati pelanggan sudah standby di rumah. Mohon periksa FAT port 8.",
      is_read: true,
      created_at: new Date(Date.now() - 36e5).toISOString()
    });
    this.ticketMessages.push({
      id: crypto.randomUUID(),
      wo_id: "wo-uuid-001",
      wo_number: "WO-202611-0081",
      sender_id: "usr-installer-01",
      sender_name: "Budi Santoso (Installer)",
      sender_role: "Installer",
      message: "Siap Bu Dewi, saya sudah di lokasi perumahan. Segera kami tarik dropcore 150m.",
      is_read: false,
      created_at: new Date(Date.now() - 18e5).toISOString()
    });
    this.auditLogs.push({
      id: crypto.randomUUID(),
      user_id: "usr-superadmin-01",
      user_name: "Super Administrator",
      role: "Superadmin",
      activity: "SYSTEM_INITIALIZATION",
      module: "Core System",
      ip_address: "127.0.0.1",
      diff_data: { status: "INITIALIZED", baseline: "WebJaws Session 1 Foundation" },
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  // --- Login attempts & Rate Limiting ---
  recordLoginAttempt(identifier, ip, success) {
    this.loginAttempts.push({
      identifier: identifier.toLowerCase().trim(),
      ip,
      success,
      time: Date.now()
    });
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1e3;
    this.loginAttempts = this.loginAttempts.filter((a) => a.time > thirtyMinsAgo);
  }
  isRateLimited(identifier, ip) {
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1e3;
    const key = identifier.toLowerCase().trim();
    const recentFailures = this.loginAttempts.filter(
      (a) => !a.success && (a.identifier === key || a.ip === ip) && a.time > fifteenMinsAgo
    );
    if (recentFailures.length >= 5) {
      const oldestRelevant = recentFailures[0].time;
      const unlockTime = oldestRelevant + 15 * 60 * 1e3;
      const waitSec = Math.max(1, Math.ceil((unlockTime - Date.now()) / 1e3));
      return { limited: true, retryAfterSeconds: waitSec };
    }
    return { limited: false };
  }
  // --- Session Management ---
  createSession(userId, ip, userAgent, durationHours = 24) {
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1e3).toISOString();
    const session = {
      id: crypto.randomUUID(),
      token,
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt,
      last_active_at: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.sessions.push(session);
    return session;
  }
  findSession(token) {
    if (!token) return null;
    const session = this.sessions.find((s) => s.token === token);
    if (!session) return null;
    if (new Date(session.expires_at) < /* @__PURE__ */ new Date()) {
      this.revokeSession(token);
      return null;
    }
    session.last_active_at = (/* @__PURE__ */ new Date()).toISOString();
    return session;
  }
  revokeSession(token) {
    this.sessions = this.sessions.filter((s) => s.token !== token);
  }
  revokeUserSessions(userId) {
    this.sessions = this.sessions.filter((s) => s.user_id !== userId);
  }
  // --- Audit Logging ---
  addAuditLog(entry) {
    const log = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 1e3) {
      this.auditLogs = this.auditLogs.slice(0, 1e3);
    }
  }
};
var webJawsStore = new WebJawsStore();

// server/auth/auth.ts
import crypto2 from "crypto";
var SESSION_COOKIE_NAME = "webjaws_session";
function hashSessionToken(token) {
  if (!token) return "";
  return crypto2.createHash("sha256").update(token).digest("hex");
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "127.0.0.1";
}
function getSessionCookieOptions(durationHours = 24) {
  const safeHours = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: safeHours * 3600 * 1e3,
    path: "/"
  };
}
function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  };
}
function extractSessionToken(req) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof token === "string" && token.length > 0 ? token : null;
}
async function createPostgresSession(userId, ip, userAgent, durationHours = 24) {
  const rawToken = crypto2.randomBytes(48).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const safeDuration = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
  const expiresAt = new Date(Date.now() + safeDuration * 3600 * 1e3);
  const dbStatus = await checkConnection();
  if (!dbStatus.connected) {
    throw new Error(`Database unavailable for session creation: ${dbStatus.error || "Connection failed"}`);
  }
  const res = await query(
    `INSERT INTO auth_sessions (token_hash, user_id, ip_address, user_agent, expires_at, last_active_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, token_hash, user_id, ip_address, user_agent, expires_at, last_active_at, created_at`,
    [tokenHash, userId, ip, userAgent, expiresAt.toISOString()]
  );
  const row = res.rows[0];
  return {
    id: row.id,
    token: rawToken,
    // Client-only raw token returned exclusively for Set-Cookie header
    user_id: row.user_id,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    expires_at: row.expires_at,
    last_active_at: row.last_active_at,
    created_at: row.created_at
  };
}
async function revokePostgresSession(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
}
async function revokeAllUserSessions(userId) {
  if (!userId) return;
  await query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
}
async function recordPostgresLoginAttempt(identifier, ip, success) {
  const cleanIdentifier = identifier.toLowerCase().trim();
  await query(
    `INSERT INTO login_attempts (identifier, ip_address, success, attempt_time)
     VALUES ($1, $2, $3, NOW())`,
    [cleanIdentifier, ip, success]
  );
}
async function checkPostgresRateLimit(identifier, _ip) {
  const cleanIdentifier = identifier.toLowerCase().trim();
  const res = await query(
    `SELECT COUNT(*)::int AS failed_count, MIN(attempt_time) AS oldest_attempt
     FROM login_attempts
     WHERE success = FALSE
       AND LOWER(identifier) = LOWER($1)
       AND attempt_time > NOW() - INTERVAL '15 minutes'`,
    [cleanIdentifier]
  );
  const failedCount = res.rows[0]?.failed_count || 0;
  if (failedCount >= 5) {
    const oldest = res.rows[0]?.oldest_attempt ? new Date(res.rows[0].oldest_attempt).getTime() : Date.now();
    const unlockTime = oldest + 15 * 60 * 1e3;
    const waitSec = Math.max(1, Math.ceil((unlockTime - Date.now()) / 1e3));
    return { limited: true, retryAfterSeconds: waitSec };
  }
  return { limited: false };
}
function sanitizeAuditData(data) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditData);
  const sanitized = {};
  const forbiddenKeys = /password|hash|token|secret|cookie|key/i;
  for (const [key, val] of Object.entries(data)) {
    if (forbiddenKeys.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeAuditData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}
async function addPostgresAuditLog(entry) {
  const sanitizedDiff = entry.diff_data ? JSON.stringify(sanitizeAuditData(entry.diff_data)) : null;
  await query(
    `INSERT INTO audit_logs (user_id, user_name, role, activity, module, record_id, diff_data, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      entry.user_id || null,
      entry.user_name,
      entry.role || null,
      entry.activity,
      entry.module,
      entry.record_id || null,
      sanitizedDiff,
      entry.ip_address,
      entry.user_agent || null
    ]
  );
}
async function requireAuth(req, res, next) {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }
  const tokenHash = hashSessionToken(token);
  try {
    const sessionRes = await query(
      `SELECT 
        s.id AS session_id,
        s.token_hash,
        s.user_id,
        s.expires_at,
        s.last_active_at,
        u.id AS user_id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.contractor_name,
        u.area,
        u.phone,
        u.avatar_url,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at
       FROM auth_sessions s
       JOIN staff_users u ON s.user_id = u.id
       WHERE s.token_hash = $1`,
      [tokenHash]
    );
    if (sessionRes.rowCount === 0) {
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
      return res.status(401).json({ success: false, error: "Session invalid or expired", code: "SESSION_EXPIRED" });
    }
    const row = sessionRes.rows[0];
    if (row.token_hash) {
      const computedBuf = Buffer.from(tokenHash, "hex");
      const storedBuf = Buffer.from(row.token_hash, "hex");
      if (computedBuf.length !== storedBuf.length || !crypto2.timingSafeEqual(computedBuf, storedBuf)) {
        res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
        return res.status(401).json({ success: false, error: "Session verification failed", code: "SESSION_EXPIRED" });
      }
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await revokePostgresSession(token).catch(() => {
      });
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
      return res.status(401).json({ success: false, error: "Session expired", code: "SESSION_EXPIRED" });
    }
    if (!row.is_active) {
      await revokePostgresSession(token).catch(() => {
      });
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
      return res.status(403).json({ success: false, error: "Account is inactive", code: "ACCOUNT_INACTIVE" });
    }
    query("UPDATE auth_sessions SET last_active_at = NOW() WHERE token_hash = $1", [tokenHash]).catch(() => {
    });
    const safeUser = {
      id: row.user_id,
      username: row.username,
      email: row.email,
      password_hash: "",
      // Never expose password_hash
      full_name: row.full_name,
      role: row.role,
      contractor_name: row.contractor_name || void 0,
      area: row.area || void 0,
      phone: row.phone || void 0,
      avatar_url: row.avatar_url || void 0,
      is_active: row.is_active,
      last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : void 0,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString()
    };
    req.user = safeUser;
    req.sessionToken = token;
    return next();
  } catch (error) {
    console.error("requireAuth database error:", error.message);
    return res.status(503).json({
      success: false,
      error: "Authentication service temporarily unavailable",
      code: "DATABASE_UNAVAILABLE"
    });
  }
}
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: "Authentication required" });
    if (req.user.role === "Superadmin" || allowedRoles.includes(req.user.role)) return next();
    return res.status(403).json({ success: false, error: "Insufficient role permissions", code: "INSUFFICIENT_PERMISSIONS" });
  };
}

// server/routes/authRoutes.ts
var authRouter = Router();
authRouter.post("/login", async (req, res) => {
  const { identifier, password } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "Unknown Browser";
  if (!identifier || typeof identifier !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      error: "Username/Email and password are required"
    });
  }
  const cleanIdentifier = identifier.trim().toLowerCase();
  try {
    const rateLimitStatus = await checkPostgresRateLimit(cleanIdentifier, ip);
    if (rateLimitStatus.limited) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateLimitStatus.retryAfterSeconds} seconds.`,
        retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
        code: "RATE_LIMITED"
      });
    }
  } catch (err) {
    console.error("Rate limit error:", err.message);
    return res.status(503).json({
      success: false,
      error: "Authentication service temporarily unavailable",
      code: "DATABASE_UNAVAILABLE"
    });
  }
  try {
    const userRes = await query(
      `SELECT 
        id, username, email, password_hash, full_name, role, contractor_name, area, phone, avatar_url,
        is_active, last_login_at, created_at, updated_at
       FROM staff_users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
       LIMIT 1`,
      [cleanIdentifier]
    );
    if (userRes.rowCount === 0) {
      await recordPostgresLoginAttempt(cleanIdentifier, ip, false).catch(() => {
      });
      return res.status(401).json({
        success: false,
        error: "Invalid username/email or password",
        code: "INVALID_CREDENTIALS"
      });
    }
    const user = userRes.rows[0];
    if (!user.is_active) {
      await recordPostgresLoginAttempt(cleanIdentifier, ip, false).catch(() => {
      });
      return res.status(403).json({
        success: false,
        error: "This account has been disabled. Please contact the Superadmin.",
        code: "ACCOUNT_INACTIVE"
      });
    }
    const isPasswordValid = await bcrypt2.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await recordPostgresLoginAttempt(cleanIdentifier, ip, false).catch(() => {
      });
      return res.status(401).json({
        success: false,
        error: "Invalid username/email or password",
        code: "INVALID_CREDENTIALS"
      });
    }
    await recordPostgresLoginAttempt(cleanIdentifier, ip, true).catch(() => {
    });
    await query(
      `UPDATE staff_users 
       SET last_login_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [user.id]
    );
    const durationHours = Number(process.env.SESSION_DURATION_HOURS || 24);
    const safeDurationHours = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
    const session = await createPostgresSession(user.id, ip, userAgent, safeDurationHours);
    res.cookie(SESSION_COOKIE_NAME, session.token, getSessionCookieOptions(safeDurationHours));
    await addPostgresAuditLog({
      user_id: user.id,
      user_name: user.full_name,
      role: user.role,
      activity: "LOGIN_SUCCESS",
      module: "Authentication",
      ip_address: ip,
      user_agent: userAgent
    }).catch((err) => console.error("Failed to write login audit log:", err.message));
    const { password_hash, ...safeUser } = user;
    return res.json({
      success: true,
      message: "Login successful",
      user: safeUser
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(503).json({
      success: false,
      error: "Authentication service temporarily unavailable",
      code: "DATABASE_UNAVAILABLE"
    });
  }
});
authRouter.post("/logout", async (req, res) => {
  const token = extractSessionToken(req);
  const ip = getClientIp(req);
  if (token) {
    try {
      const tokenHash = hashSessionToken(token);
      const sessionRes = await query(
        `SELECT s.user_id, u.full_name, u.role
         FROM auth_sessions s
         LEFT JOIN staff_users u ON s.user_id = u.id
         WHERE s.token_hash = $1`,
        [tokenHash]
      );
      if (sessionRes.rowCount && sessionRes.rows[0]) {
        const row = sessionRes.rows[0];
        await addPostgresAuditLog({
          user_id: row.user_id,
          user_name: row.full_name || "Staff User",
          role: row.role || "User",
          activity: "LOGOUT",
          module: "Authentication",
          ip_address: ip,
          user_agent: req.headers["user-agent"] || void 0
        }).catch(() => {
        });
      }
      await revokePostgresSession(token);
    } catch (err) {
      console.error("Logout error:", err.message);
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
      return res.status(500).json({
        success: false,
        error: "Failed to revoke session from database",
        code: "LOGOUT_FAILED"
      });
    }
  }
  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  return res.json({
    success: true,
    message: "Logged out successfully"
  });
});
authRouter.post("/logout-all", requireAuth, async (req, res) => {
  const user = req.user;
  const ip = getClientIp(req);
  try {
    await revokeAllUserSessions(user.id);
    await addPostgresAuditLog({
      user_id: user.id,
      user_name: user.full_name,
      role: user.role,
      activity: "LOGOUT_ALL_DEVICES",
      module: "Authentication",
      ip_address: ip,
      user_agent: req.headers["user-agent"] || void 0
    }).catch(() => {
    });
  } catch (err) {
    console.error("Logout-all error:", err.message);
    res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
    return res.status(500).json({
      success: false,
      error: "Failed to revoke all sessions from database",
      code: "LOGOUT_ALL_FAILED"
    });
  }
  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  return res.json({
    success: true,
    message: "Logged out from all devices successfully"
  });
});
authRouter.get("/me", requireAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "User not found" });
  }
  const { password_hash, ...safeUser } = req.user;
  return res.json({
    success: true,
    user: safeUser,
    appConfig: webJawsStore.activeConfig
  });
});
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "Unknown Browser";
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: "Current and new password are required" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: "New password must be at least 8 characters long" });
  }
  const user = req.user;
  try {
    const userRes = await query("SELECT password_hash FROM staff_users WHERE id = $1", [user.id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const currentHash = userRes.rows[0].password_hash;
    const isValid = await bcrypt2.compare(currentPassword, currentHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Incorrect current password" });
    }
    const salt = await bcrypt2.genSalt(10);
    const newHash = await bcrypt2.hash(newPassword, salt);
    await query("UPDATE staff_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, user.id]);
    await revokeAllUserSessions(user.id);
    const durationHours = Number(process.env.SESSION_DURATION_HOURS || 24);
    const safeDurationHours = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
    const freshSession = await createPostgresSession(user.id, ip, userAgent, safeDurationHours);
    res.cookie(SESSION_COOKIE_NAME, freshSession.token, getSessionCookieOptions(safeDurationHours));
    await addPostgresAuditLog({
      user_id: user.id,
      user_name: user.full_name,
      role: user.role,
      activity: "CHANGE_PASSWORD",
      module: "Authentication",
      ip_address: ip,
      user_agent: userAgent
    });
    return res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Change password error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to change password" });
  }
});

// server/routes/userRoutes.ts
import { Router as Router2 } from "express";
import bcrypt3 from "bcryptjs";
var userRouter = Router2();
userRouter.use(requireAuth);
userRouter.get("/", requireRole(["Superadmin", "IT Support Application"]), async (req, res) => {
  const { role, is_active, search } = req.query;
  try {
    let sql = `
      SELECT id, username, email, full_name, role, contractor_name, area, phone, avatar_url,
             is_active, last_login_at, created_at, updated_at
      FROM staff_users
      WHERE 1=1
    `;
    const params = [];
    if (role && typeof role === "string") {
      params.push(role);
      sql += ` AND role = $${params.length}`;
    }
    if (is_active !== void 0) {
      const activeBool = is_active === "true";
      params.push(activeBool);
      sql += ` AND is_active = $${params.length}`;
    }
    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (
        LOWER(username) LIKE $${params.length} OR
        LOWER(full_name) LIKE $${params.length} OR
        LOWER(email) LIKE $${params.length} OR
        LOWER(COALESCE(contractor_name, '')) LIKE $${params.length} OR
        LOWER(COALESCE(area, '')) LIKE $${params.length}
      )`;
    }
    sql += " ORDER BY created_at DESC";
    const result = await query(sql, params);
    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      password_hash: "",
      full_name: row.full_name,
      role: row.role,
      contractor_name: row.contractor_name || void 0,
      area: row.area || void 0,
      phone: row.phone || void 0,
      avatar_url: row.avatar_url || void 0,
      is_active: row.is_active,
      last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : void 0,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString()
    }));
    return res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (err) {
    console.error("List users error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to retrieve staff users" });
  }
});
userRouter.post("/", requireRole(["Superadmin"]), async (req, res) => {
  const { username, email, password, full_name, role, contractor_name, area, phone } = req.body || {};
  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({
      success: false,
      error: "Fields username, email, password, full_name, and role are required"
    });
  }
  const validRoles = [
    "Superadmin",
    "Agent Dispatch",
    "Leader",
    "Installer",
    "Monitoring Data",
    "IT Support Application"
  ];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: `Invalid role '${role}'. Must be one of: ${validRoles.join(", ")}`
    });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  try {
    const existing = await query(
      "SELECT id FROM staff_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1",
      [cleanUsername, cleanEmail]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({
        success: false,
        error: "A user with this username or email already exists"
      });
    }
    const salt = await bcrypt3.genSalt(10);
    const passwordHash = await bcrypt3.hash(password, salt);
    const insertRes = await query(
      `INSERT INTO staff_users (
        username, email, password_hash, full_name, role, contractor_name, area, phone, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
      RETURNING id, username, email, full_name, role, contractor_name, area, phone, is_active, created_at, updated_at`,
      [
        cleanUsername,
        cleanEmail,
        passwordHash,
        String(full_name).trim(),
        role,
        contractor_name ? String(contractor_name).trim() : null,
        area ? String(area).trim() : null,
        phone ? String(phone).trim() : null
      ]
    );
    const newUser = insertRes.rows[0];
    await addPostgresAuditLog({
      user_id: req.user.id,
      user_name: req.user.full_name,
      role: req.user.role,
      activity: "CREATE_STAFF_USER",
      module: "Management User",
      record_id: newUser.id,
      diff_data: { username: newUser.username, role: newUser.role, contractor: newUser.contractor_name, area: newUser.area },
      ip_address: getClientIp(req),
      user_agent: req.headers["user-agent"] || void 0
    });
    return res.status(201).json({
      success: true,
      message: `Staff user '${newUser.username}' created successfully`,
      user: newUser
    });
  } catch (err) {
    console.error("Create user error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to create staff user" });
  }
});
userRouter.put("/:id", requireRole(["Superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { full_name, role, contractor_name, area, phone } = req.body || {};
  try {
    const userRes = await query("SELECT * FROM staff_users WHERE id = $1", [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Staff user not found" });
    }
    const user = userRes.rows[0];
    if (user.role === "Superadmin" && role && role !== "Superadmin") {
      const activeSuperadmins = await query(
        "SELECT COUNT(*)::int AS count FROM staff_users WHERE role = 'Superadmin' AND is_active = TRUE"
      );
      if ((activeSuperadmins.rows[0]?.count || 0) <= 1) {
        return res.status(400).json({
          success: false,
          error: "Cannot demote the last remaining active Superadmin"
        });
      }
    }
    const updatedFullName = full_name ? String(full_name).trim() : user.full_name;
    const updatedRole = role || user.role;
    const updatedContractor = contractor_name !== void 0 ? contractor_name ? String(contractor_name).trim() : null : user.contractor_name;
    const updatedArea = area !== void 0 ? area ? String(area).trim() : null : user.area;
    const updatedPhone = phone !== void 0 ? phone ? String(phone).trim() : null : user.phone;
    const updateRes = await query(
      `UPDATE staff_users
       SET full_name = $1, role = $2, contractor_name = $3, area = $4, phone = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, email, full_name, role, contractor_name, area, phone, avatar_url, is_active, last_login_at, created_at, updated_at`,
      [updatedFullName, updatedRole, updatedContractor, updatedArea, updatedPhone, id]
    );
    const safeUser = updateRes.rows[0];
    await addPostgresAuditLog({
      user_id: req.user.id,
      user_name: req.user.full_name,
      role: req.user.role,
      activity: "UPDATE_STAFF_USER",
      module: "Management User",
      record_id: user.id,
      diff_data: { full_name: safeUser.full_name, role: safeUser.role, contractor_name: safeUser.contractor_name, area: safeUser.area },
      ip_address: getClientIp(req),
      user_agent: req.headers["user-agent"] || void 0
    });
    return res.json({
      success: true,
      message: "Staff user updated successfully",
      user: safeUser
    });
  } catch (err) {
    console.error("Update user error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to update staff user" });
  }
});
userRouter.patch("/:id/status", requireRole(["Superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body || {};
  if (typeof is_active !== "boolean") {
    return res.status(400).json({ success: false, error: "is_active must be a boolean" });
  }
  try {
    const userRes = await query("SELECT id, username, role FROM staff_users WHERE id = $1", [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Staff user not found" });
    }
    if (id === req.user.id && !is_active) {
      return res.status(400).json({ success: false, error: "You cannot deactivate your own account" });
    }
    await query("UPDATE staff_users SET is_active = $1, updated_at = NOW() WHERE id = $2", [is_active, id]);
    if (!is_active) {
      await revokeAllUserSessions(id);
    }
    await addPostgresAuditLog({
      user_id: req.user.id,
      user_name: req.user.full_name,
      role: req.user.role,
      activity: is_active ? "ACTIVATE_STAFF_USER" : "DEACTIVATE_STAFF_USER",
      module: "Management User",
      record_id: id,
      ip_address: getClientIp(req),
      user_agent: req.headers["user-agent"] || void 0
    });
    return res.json({
      success: true,
      message: `Account status updated to ${is_active ? "Active" : "Inactive"}`,
      is_active
    });
  } catch (err) {
    console.error("Toggle status error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to update account status" });
  }
});
userRouter.post("/:id/reset-password", requireRole(["Superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body || {};
  if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
    return res.status(400).json({
      success: false,
      error: "New password is required and must be at least 8 characters long"
    });
  }
  try {
    const userRes = await query("SELECT id, username FROM staff_users WHERE id = $1", [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Staff user not found" });
    }
    const salt = await bcrypt3.genSalt(10);
    const passwordHash = await bcrypt3.hash(new_password, salt);
    await query("UPDATE staff_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, id]);
    await revokeAllUserSessions(id);
    await addPostgresAuditLog({
      user_id: req.user.id,
      user_name: req.user.full_name,
      role: req.user.role,
      activity: "RESET_STAFF_PASSWORD",
      module: "Management User",
      record_id: id,
      ip_address: getClientIp(req),
      user_agent: req.headers["user-agent"] || void 0
    });
    return res.json({
      success: true,
      message: `Password reset successfully for ${userRes.rows[0].username}`
    });
  } catch (err) {
    console.error("Reset password error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to reset staff password" });
  }
});

// server/routes/configRoutes.ts
import { Router as Router3 } from "express";
import crypto3 from "crypto";
var configRouter = Router3();
configRouter.get("/", (req, res) => {
  return res.json({
    success: true,
    config: webJawsStore.activeConfig
  });
});
configRouter.use(requireAuth);
configRouter.post("/", requireRole(["Superadmin"]), (req, res) => {
  const { newConfig, changeSummary, title } = req.body;
  if (!newConfig) {
    return res.status(400).json({ success: false, error: "newConfig payload is required" });
  }
  const currentVersion = webJawsStore.activeConfig.version;
  const nextVersion = currentVersion + 1;
  const versionedConfig = {
    ...newConfig,
    version: nextVersion
  };
  const versionRecord = {
    version_id: crypto3.randomUUID(),
    version_number: nextVersion,
    title: title || `Configuration Update v${nextVersion}`,
    config_data: versionedConfig,
    change_summary: changeSummary || "Centralized configuration modified by Superadmin",
    created_by_name: req.user.full_name,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  webJawsStore.configVersions.unshift(versionRecord);
  webJawsStore.activeConfig = versionedConfig;
  webJawsStore.addAuditLog({
    user_id: req.user.id,
    user_name: req.user.full_name,
    role: req.user.role,
    activity: "UPDATE_APP_CONFIG",
    module: "Centralized Configuration",
    record_id: versionRecord.version_id,
    diff_data: { version: nextVersion, summary: changeSummary },
    ip_address: getClientIp(req)
  });
  return res.json({
    success: true,
    message: `Application configuration updated to version ${nextVersion}`,
    config: versionedConfig,
    versionRecord
  });
});
configRouter.get("/versions", requireRole(["Superadmin"]), (req, res) => {
  return res.json({
    success: true,
    versions: webJawsStore.configVersions
  });
});
configRouter.post("/rollback/:versionNumber", requireRole(["Superadmin"]), (req, res) => {
  const targetVer = parseInt(req.params.versionNumber, 10);
  if (isNaN(targetVer)) {
    return res.status(400).json({ success: false, error: "Invalid version number" });
  }
  const targetRecord = webJawsStore.configVersions.find((v) => v.version_number === targetVer);
  if (!targetRecord) {
    return res.status(404).json({ success: false, error: `Config version ${targetVer} not found` });
  }
  const nextVer = webJawsStore.activeConfig.version + 1;
  const restoredConfig = {
    ...targetRecord.config_data,
    version: nextVer
  };
  const rollbackRecord = {
    version_id: crypto3.randomUUID(),
    version_number: nextVer,
    title: `Rollback to Version ${targetVer}`,
    config_data: restoredConfig,
    change_summary: `Rollback executed by ${req.user.full_name} targeting baseline from v${targetVer}`,
    created_by_name: req.user.full_name,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  webJawsStore.configVersions.unshift(rollbackRecord);
  webJawsStore.activeConfig = restoredConfig;
  webJawsStore.addAuditLog({
    user_id: req.user.id,
    user_name: req.user.full_name,
    role: req.user.role,
    activity: "ROLLBACK_APP_CONFIG",
    module: "Centralized Configuration",
    record_id: rollbackRecord.version_id,
    diff_data: { rolledBackTo: targetVer, newVersion: nextVer },
    ip_address: getClientIp(req)
  });
  return res.json({
    success: true,
    message: `Configuration successfully rolled back to state of v${targetVer} (now active as v${nextVer})`,
    config: restoredConfig
  });
});
configRouter.get("/droplists", (req, res) => {
  const { category } = req.query;
  let items = webJawsStore.dropdowns.filter((d) => d.is_active);
  if (category && typeof category === "string") {
    items = items.filter((d) => d.category === category);
  }
  items.sort((a, b) => a.order_index - b.order_index);
  return res.json({
    success: true,
    droplists: items
  });
});
configRouter.post("/droplists", requireRole(["Superadmin"]), (req, res) => {
  const { category, label, value, order_index } = req.body;
  if (!category || !label || !value) {
    return res.status(400).json({ success: false, error: "Category, label, and value are required" });
  }
  const existingInCat = webJawsStore.dropdowns.filter((d) => d.category === category);
  const nextOrder = order_index !== void 0 ? order_index : existingInCat.length + 1;
  const newItem = {
    id: crypto3.randomUUID(),
    category,
    label: label.trim(),
    value: value.trim(),
    order_index: nextOrder,
    is_active: true
  };
  webJawsStore.dropdowns.push(newItem);
  webJawsStore.addAuditLog({
    user_id: req.user.id,
    user_name: req.user.full_name,
    role: req.user.role,
    activity: "ADD_DROPLIST_OPTION",
    module: "Setting Droplist",
    record_id: newItem.id,
    diff_data: { category, label, value },
    ip_address: getClientIp(req)
  });
  return res.status(201).json({
    success: true,
    message: `Dropdown option '${newItem.label}' added`,
    item: newItem
  });
});
configRouter.delete("/droplists/:id", requireRole(["Superadmin"]), (req, res) => {
  const { id } = req.params;
  const index = webJawsStore.dropdowns.findIndex((d) => d.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Dropdown item not found" });
  }
  const removed = webJawsStore.dropdowns.splice(index, 1)[0];
  webJawsStore.addAuditLog({
    user_id: req.user.id,
    user_name: req.user.full_name,
    role: req.user.role,
    activity: "DELETE_DROPLIST_OPTION",
    module: "Setting Droplist",
    record_id: id,
    diff_data: { removedItem: removed },
    ip_address: getClientIp(req)
  });
  return res.json({
    success: true,
    message: "Dropdown item deleted successfully"
  });
});

// server/routes/woRoutes.ts
import { Router as Router4 } from "express";
import crypto4 from "crypto";
var woRouter = Router4();
woRouter.use(requireAuth);
function filterWOsForUser(user, wos) {
  if (user.role === "Superadmin" || user.role === "Agent Dispatch" || user.role === "Monitoring Data" || user.role === "IT Support Application") {
    return wos;
  }
  if (user.role === "Leader") {
    return wos.filter((wo) => {
      let matchContractor = true;
      let matchArea = true;
      if (user.contractor_name && wo.contactor_name) {
        matchContractor = wo.contactor_name.toLowerCase().includes(user.contractor_name.toLowerCase()) || user.contractor_name.toLowerCase().includes(wo.contactor_name.toLowerCase());
      }
      if (user.area && wo.area) {
        matchArea = wo.area.toLowerCase().includes(user.area.toLowerCase()) || user.area.toLowerCase().includes(wo.area.toLowerCase());
      }
      return matchContractor && matchArea;
    });
  }
  if (user.role === "Installer") {
    return wos.filter((wo) => {
      const matchId = wo.assigned_installer_id === user.id;
      const matchName = wo.installer_name && user.full_name && wo.installer_name.toLowerCase().includes(user.full_name.toLowerCase());
      return matchId || matchName;
    });
  }
  return [];
}
woRouter.get("/", (req, res) => {
  const user = req.user;
  let filtered = filterWOsForUser(user, webJawsStore.workOrders);
  const {
    status_agent,
    status_installer,
    system_status,
    contractor,
    area,
    search,
    sort_by = "created_at",
    sort_dir = "desc",
    page = "1",
    limit = "50"
  } = req.query;
  if (status_agent && typeof status_agent === "string") {
    filtered = filtered.filter((w) => w.status_wo_agent.toLowerCase() === status_agent.toLowerCase());
  }
  if (status_installer && typeof status_installer === "string") {
    filtered = filtered.filter((w) => w.status_wo_installer.toLowerCase() === status_installer.toLowerCase());
  }
  if (system_status && typeof system_status === "string") {
    filtered = filtered.filter((w) => w.system_status.toLowerCase() === system_status.toLowerCase());
  }
  if (contractor && typeof contractor === "string") {
    filtered = filtered.filter((w) => w.contactor_name && w.contactor_name.toLowerCase().includes(contractor.toLowerCase()));
  }
  if (area && typeof area === "string") {
    filtered = filtered.filter((w) => w.area && w.area.toLowerCase().includes(area.toLowerCase()));
  }
  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (w) => w.wo_number.toLowerCase().includes(q) || w.customer_name && w.customer_name.toLowerCase().includes(q) || w.id_customer && w.id_customer.toLowerCase().includes(q) || w.customer_phone && w.customer_phone.includes(q) || w.ticket_number && w.ticket_number.toLowerCase().includes(q) || w.fat_code && w.fat_code.toLowerCase().includes(q) || w.installer_name && w.installer_name.toLowerCase().includes(q)
    );
  }
  const sortByStr = String(sort_by);
  const isAsc = String(sort_dir).toLowerCase() === "asc";
  filtered.sort((a, b) => {
    const valA = a[sortByStr] || "";
    const valB = b[sortByStr] || "";
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
    workOrders: paginated
  });
});
woRouter.get("/stats", (req, res) => {
  const user = req.user;
  const wos = filterWOsForUser(user, webJawsStore.workOrders);
  const totalWO = wos.length;
  const woRequested = wos.filter((w) => w.system_status === "Requested").length;
  const cancelCount = wos.filter((w) => w.status_wo_agent === "Cancel").length;
  const pendingCount = wos.filter((w) => w.status_wo_agent === "Pending" || w.status_wo_installer === "Pending").length;
  const rescheduleCount = wos.filter((w) => w.status_wo_agent === "Reschedule" || w.status_wo_installer === "Reschedule").length;
  const approvedAgent = wos.filter((w) => w.status_wo_agent === "Approved").length;
  const unhandledAgent = wos.filter((w) => w.status_wo_agent === "Unhandled").length;
  const unhandledInstaller = wos.filter((w) => w.status_wo_installer === "Unhandled").length;
  const byContractor = {};
  const byArea = {};
  const byInstaller = {};
  wos.forEach((w) => {
    const c = w.contactor_name || "Unassigned Contractor";
    byContractor[c] = (byContractor[c] || 0) + 1;
    const a = w.area || "Unassigned Area";
    byArea[a] = (byArea[a] || 0) + 1;
    const inst = w.installer_name || "Unassigned Installer";
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
        byInstaller
      }
    }
  });
});
woRouter.get("/:id", (req, res) => {
  const { id } = req.params;
  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);
  if (!wo) {
    return res.status(404).json({ success: false, error: "Work Order not found" });
  }
  const accessibleWos = filterWOsForUser(req.user, [wo]);
  if (accessibleWos.length === 0) {
    return res.status(403).json({
      success: false,
      error: "Access Denied: You do not have permission to view this Work Order"
    });
  }
  const history = webJawsStore.statusHistory.filter((h) => h.wo_id === wo.id || h.wo_number === wo.wo_number);
  return res.json({
    success: true,
    workOrder: wo,
    statusHistory: history
  });
});
woRouter.patch("/:id/agent-status", (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (user.role !== "Superadmin" && user.role !== "Agent Dispatch") {
    return res.status(403).json({
      success: false,
      error: "Only Superadmin or Agent Dispatch can update Agent Status"
    });
  }
  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);
  if (!wo) {
    return res.status(404).json({ success: false, error: "Work Order not found" });
  }
  const { status_wo_agent, reason_wo_agent, rootcause_wo_agent, remarks_wo_agent, approve_complete } = req.body;
  const validAgentStatuses = ["Approved", "Pending", "Cancel", "Reschedule", "Unhandled"];
  if (!validAgentStatuses.includes(status_wo_agent)) {
    return res.status(400).json({
      success: false,
      error: `Invalid Agent Status. Must be one of: ${validAgentStatuses.join(", ")}`
    });
  }
  const prevAgentStatus = wo.status_wo_agent;
  const prevSystemStatus = wo.system_status;
  wo.status_wo_agent = status_wo_agent;
  wo.date_report_agent = (/* @__PURE__ */ new Date()).toISOString();
  if (reason_wo_agent !== void 0) wo.reason_wo_agent = reason_wo_agent;
  if (rootcause_wo_agent !== void 0) wo.rootcause_wo_agent = rootcause_wo_agent;
  if (remarks_wo_agent !== void 0) wo.remarks_wo_agent = remarks_wo_agent;
  if (approve_complete === true && status_wo_agent === "Approved") {
    wo.system_status = "Completed";
  } else if (status_wo_agent === "Pending" || status_wo_agent === "Reschedule") {
    wo.system_status = "In Progress";
  }
  wo.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  const historyEntry = {
    id: crypto4.randomUUID(),
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
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  webJawsStore.statusHistory.unshift(historyEntry);
  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: "UPDATE_WO_AGENT_STATUS",
    module: "Management WO",
    record_id: wo.wo_number,
    diff_data: { from: prevAgentStatus, to: status_wo_agent, systemStatus: wo.system_status },
    ip_address: getClientIp(req)
  });
  return res.json({
    success: true,
    message: `Agent status updated to ${status_wo_agent}`,
    workOrder: wo
  });
});
woRouter.patch("/:id/installer-status", (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);
  if (!wo) {
    return res.status(404).json({ success: false, error: "Work Order not found" });
  }
  if (user.role === "Installer") {
    const isAssigned = wo.assigned_installer_id === user.id || wo.installer_name && user.full_name && wo.installer_name.toLowerCase().includes(user.full_name.toLowerCase());
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: "Installers can only submit reports for work orders assigned to them"
      });
    }
  }
  const { status_wo_installer, reason_wo_installer, rootcause_wo_installer, remarks_wo_installer } = req.body;
  const validInstallerStatuses = ["Done", "Pending", "Reschedule", "Unhandled"];
  if (!validInstallerStatuses.includes(status_wo_installer)) {
    return res.status(400).json({
      success: false,
      error: `Invalid Installer Status. Must be one of: ${validInstallerStatuses.join(", ")}`
    });
  }
  const prevInstallerStatus = wo.status_wo_installer;
  const prevSystemStatus = wo.system_status;
  wo.status_wo_installer = status_wo_installer;
  if (!wo.date_report_installer) {
    wo.date_report_installer = (/* @__PURE__ */ new Date()).toISOString();
  } else {
    wo.date_report_installer2 = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (reason_wo_installer !== void 0) wo.reason_wo_installer = reason_wo_installer;
  if (rootcause_wo_installer !== void 0) wo.rootcause_wo_installer = rootcause_wo_installer;
  if (remarks_wo_installer !== void 0) wo.remarks_wo_installer = remarks_wo_installer;
  if (wo.system_status === "Requested" || wo.system_status === "Assigned") {
    wo.system_status = "In Progress";
  }
  wo.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  const historyEntry = {
    id: crypto4.randomUUID(),
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
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  webJawsStore.statusHistory.unshift(historyEntry);
  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: "UPDATE_WO_INSTALLER_STATUS",
    module: "Installer",
    record_id: wo.wo_number,
    diff_data: { from: prevInstallerStatus, to: status_wo_installer },
    ip_address: getClientIp(req)
  });
  return res.json({
    success: true,
    message: `Installer status submitted as ${status_wo_installer} (awaiting Dispatch review)`,
    workOrder: wo
  });
});
woRouter.patch("/:id/assign", (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (user.role !== "Superadmin" && user.role !== "Agent Dispatch" && user.role !== "Leader") {
    return res.status(403).json({ success: false, error: "Unauthorized to assign work orders" });
  }
  const wo = webJawsStore.workOrders.find((w) => w.id === id || w.wo_number === id);
  if (!wo) {
    return res.status(404).json({ success: false, error: "Work Order not found" });
  }
  const { installer_name, assigned_installer_id, slot_time } = req.body;
  if (installer_name !== void 0) wo.installer_name = installer_name;
  if (assigned_installer_id !== void 0) wo.assigned_installer_id = assigned_installer_id;
  if (slot_time !== void 0) wo.slot_time = slot_time;
  wo.date_assign_teknisi = (/* @__PURE__ */ new Date()).toISOString();
  if (wo.system_status === "Requested") {
    wo.system_status = "Assigned";
  }
  wo.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: "ASSIGN_WO_INSTALLER",
    module: "Distribute WO",
    record_id: wo.wo_number,
    diff_data: { installer: wo.installer_name, slot: wo.slot_time },
    ip_address: getClientIp(req)
  });
  return res.json({
    success: true,
    message: `WO assigned to installer ${wo.installer_name || "unassigned"}`,
    workOrder: wo
  });
});

// server/routes/importRoutes.ts
import { Router as Router5 } from "express";
import crypto5 from "crypto";
import * as xlsx from "xlsx";
var importRouter = Router5();
importRouter.use(requireAuth);
var BASELINE_44_HEADERS = [
  "Date",
  "File Name",
  "Date Upload",
  "Date Assign Agent",
  "Date Assign Teknisi",
  "Agent ID",
  "ID Customer",
  "WO Number",
  "Customer Name",
  "Customer Phone",
  "Customer Phone2",
  "Customer Phone3",
  "Contactor Name",
  "Area",
  "Installer Name",
  "Slot Time",
  "Street Name",
  "Street Alternatif",
  "Cluster Name",
  "FDT Code",
  "FAT Code",
  "Ticket Number",
  "Ticket Category",
  "Date Report Agent",
  "Status WO Agent",
  "Reason WO Agent",
  "Rootcause WO Agent",
  "Remarks WO Agent",
  "Date Report Installer",
  "Date Report Installer2",
  "Status WO Installer",
  "Reason WO Installer",
  "Rootcause WO Installer",
  "Remarks WO Installer",
  "Destination Call",
  "Reason Call",
  "Remarks Call",
  "Agent TA",
  "Status TA",
  "Remarks TA",
  "Flag",
  "Agent Ret",
  "Status Ret",
  "Remarks Ret"
];
function normalizeHeader(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ",";
  const firstFew = lines.slice(0, 5);
  const delimiters = ["	", ";", ",", "|"];
  let bestDelim = ",";
  let bestScore = -1;
  for (const delim of delimiters) {
    const counts = firstFew.map((l) => l.split(delim).length);
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
function mapRowToWO(rawRow, headerMap, fileName) {
  const getVal = (stdHeader) => {
    for (const [rawKey, mappedStd] of Object.entries(headerMap)) {
      if (mappedStd === stdHeader && rawRow[rawKey] !== void 0 && rawRow[rawKey] !== null) {
        return String(rawRow[rawKey]).trim();
      }
    }
    if (rawRow[stdHeader] !== void 0 && rawRow[stdHeader] !== null) {
      return String(rawRow[stdHeader]).trim();
    }
    return "";
  };
  const woNumber = getVal("WO Number");
  const dateStr = getVal("Date") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return {
    wo_number: woNumber,
    date: dateStr,
    file_name: fileName || getVal("File Name") || "Direct_Text_Import",
    date_upload: (/* @__PURE__ */ new Date()).toISOString(),
    date_assign_agent: getVal("Date Assign Agent"),
    date_assign_teknisi: getVal("Date Assign Teknisi"),
    agent_id: getVal("Agent ID"),
    id_customer: getVal("ID Customer"),
    customer_name: getVal("Customer Name"),
    customer_phone: getVal("Customer Phone"),
    customer_phone2: getVal("Customer Phone2"),
    customer_phone3: getVal("Customer Phone3"),
    contactor_name: getVal("Contactor Name"),
    area: getVal("Area"),
    installer_name: getVal("Installer Name"),
    slot_time: getVal("Slot Time"),
    street_name: getVal("Street Name"),
    street_alternatif: getVal("Street Alternatif"),
    cluster_name: getVal("Cluster Name"),
    fdt_code: getVal("FDT Code"),
    fat_code: getVal("FAT Code"),
    ticket_number: getVal("Ticket Number"),
    ticket_category: getVal("Ticket Category"),
    date_report_agent: getVal("Date Report Agent"),
    status_wo_agent: getVal("Status WO Agent") || "Unhandled",
    reason_wo_agent: getVal("Reason WO Agent"),
    rootcause_wo_agent: getVal("Rootcause WO Agent"),
    remarks_wo_agent: getVal("Remarks WO Agent"),
    date_report_installer: getVal("Date Report Installer"),
    date_report_installer2: getVal("Date Report Installer2"),
    status_wo_installer: getVal("Status WO Installer") || "Unhandled",
    reason_wo_installer: getVal("Reason WO Installer"),
    rootcause_wo_installer: getVal("Rootcause WO Installer"),
    remarks_wo_installer: getVal("Remarks WO Installer"),
    destination_call: getVal("Destination Call"),
    reason_call: getVal("Reason Call"),
    remarks_call: getVal("Remarks Call"),
    agent_ta: getVal("Agent TA"),
    status_ta: getVal("Status TA"),
    remarks_ta: getVal("Remarks TA"),
    flag: getVal("Flag"),
    agent_ret: getVal("Agent Ret"),
    status_ret: getVal("Status Ret"),
    remarks_ret: getVal("Remarks Ret"),
    system_status: "Requested"
  };
}
importRouter.post("/preview", requireRole(["Superadmin", "Agent Dispatch"]), (req, res) => {
  const { rawText, method, fileName = "Import_Batch.csv", base64Data, manualDelimiter } = req.body;
  let rawRows = [];
  let detectedHeaders = [];
  let detectedDelim = manualDelimiter || ",";
  try {
    if (method === "excel" && base64Data) {
      const buffer = Buffer.from(base64Data, "base64");
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
      if (json.length > 0) {
        detectedHeaders = Object.keys(json[0]);
        rawRows = json;
      }
    } else if (rawText && typeof rawText === "string") {
      detectedDelim = manualDelimiter || detectDelimiter(rawText);
      const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const headerLine = lines[0];
        detectedHeaders = headerLine.split(detectedDelim).map((h) => h.trim().replace(/^["']|["']$/g, ""));
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(detectedDelim).map((c) => c.trim().replace(/^["']|["']$/g, ""));
          const rowObj = {};
          detectedHeaders.forEach((h, idx) => {
            rowObj[h] = cells[idx] || "";
          });
          rawRows.push(rowObj);
        }
      }
    }
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: `Failed to parse import source: ${err.message}`
    });
  }
  if (rawRows.length === 0) {
    return res.status(400).json({
      success: false,
      error: "No valid data rows found in the provided source."
    });
  }
  const headerMapping = {};
  const unmappedHeaders = [];
  detectedHeaders.forEach((rawH) => {
    const norm = normalizeHeader(rawH);
    const match = BASELINE_44_HEADERS.find((stdH) => normalizeHeader(stdH) === norm);
    if (match) {
      headerMapping[rawH] = match;
    } else {
      if (norm === "contractorname") headerMapping[rawH] = "Contactor Name";
      else if (norm === "wonumber" || norm === "nomorwo" || norm === "woid") headerMapping[rawH] = "WO Number";
      else if (norm === "customername" || norm === "namapelanggan") headerMapping[rawH] = "Customer Name";
      else if (norm === "customerphone" || norm === "telepon" || norm === "nohp") headerMapping[rawH] = "Customer Phone";
      else {
        unmappedHeaders.push(rawH);
      }
    }
  });
  const existingWoNumbers = new Set(webJawsStore.workOrders.map((w) => w.wo_number.toLowerCase().trim()));
  const seenInBatch = /* @__PURE__ */ new Set();
  const validRows = [];
  const rowErrors = [];
  let duplicateCount = 0;
  rawRows.forEach((row, idx) => {
    const mapped = mapRowToWO(row, headerMapping, fileName);
    const woNum = mapped.wo_number ? mapped.wo_number.trim() : "";
    if (!woNum) {
      rowErrors.push({
        rowIndex: idx + 1,
        error: "Missing required WO Number",
        rawRow: row
      });
      return;
    }
    const lowerWo = woNum.toLowerCase();
    if (existingWoNumbers.has(lowerWo) || seenInBatch.has(lowerWo)) {
      duplicateCount++;
      rowErrors.push({
        rowIndex: idx + 1,
        error: `Duplicate WO Number '${woNum}' (already exists in system or batch)`,
        rawRow: row
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
      fileName
    },
    headerMapping,
    previewRows: validRows.slice(0, 15),
    rowErrors: rowErrors.slice(0, 50),
    allValidRows: validRows
    // for quick confirmation
  });
});
importRouter.post("/confirm", requireRole(["Superadmin", "Agent Dispatch"]), (req, res) => {
  const { validRows, fileName, importMethod } = req.body;
  if (!Array.isArray(validRows) || validRows.length === 0) {
    return res.status(400).json({ success: false, error: "No valid rows provided for confirmation" });
  }
  const batchId = crypto5.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let inserted = 0;
  let skipped = 0;
  const existingWoNumbers = new Set(webJawsStore.workOrders.map((w) => w.wo_number.toLowerCase().trim()));
  for (const row of validRows) {
    const woNum = row.wo_number?.trim();
    if (!woNum || existingWoNumbers.has(woNum.toLowerCase())) {
      skipped++;
      continue;
    }
    const newWo = {
      id: crypto5.randomUUID(),
      wo_number: woNum,
      date: row.date || now.split("T")[0],
      file_name: fileName || row.file_name || "Import_Batch",
      date_upload: now,
      date_assign_agent: row.date_assign_agent || void 0,
      date_assign_teknisi: row.date_assign_teknisi || void 0,
      agent_id: row.agent_id || void 0,
      id_customer: row.id_customer ? String(row.id_customer) : void 0,
      customer_name: row.customer_name || void 0,
      customer_phone: row.customer_phone ? String(row.customer_phone) : void 0,
      customer_phone2: row.customer_phone2 ? String(row.customer_phone2) : void 0,
      customer_phone3: row.customer_phone3 ? String(row.customer_phone3) : void 0,
      contactor_name: row.contactor_name || void 0,
      area: row.area || void 0,
      installer_name: row.installer_name || void 0,
      slot_time: row.slot_time || void 0,
      street_name: row.street_name || void 0,
      street_alternatif: row.street_alternatif || void 0,
      cluster_name: row.cluster_name || void 0,
      fdt_code: row.fdt_code || void 0,
      fat_code: row.fat_code || void 0,
      ticket_number: row.ticket_number || void 0,
      ticket_category: row.ticket_category || void 0,
      date_report_agent: row.date_report_agent || void 0,
      status_wo_agent: row.status_wo_agent || "Unhandled",
      reason_wo_agent: row.reason_wo_agent || void 0,
      rootcause_wo_agent: row.rootcause_wo_agent || void 0,
      remarks_wo_agent: row.remarks_wo_agent || void 0,
      date_report_installer: row.date_report_installer || void 0,
      date_report_installer2: row.date_report_installer2 || void 0,
      status_wo_installer: row.status_wo_installer || "Unhandled",
      reason_wo_installer: row.reason_wo_installer || void 0,
      rootcause_wo_installer: row.rootcause_wo_installer || void 0,
      remarks_wo_installer: row.remarks_wo_installer || void 0,
      destination_call: row.destination_call || void 0,
      reason_call: row.reason_call || void 0,
      remarks_call: row.remarks_call || void 0,
      agent_ta: row.agent_ta || void 0,
      status_ta: row.status_ta || void 0,
      remarks_ta: row.remarks_ta || void 0,
      flag: row.flag || void 0,
      agent_ret: row.agent_ret || void 0,
      status_ret: row.status_ret || void 0,
      remarks_ret: row.remarks_ret || void 0,
      system_status: "Requested",
      import_batch_id: batchId,
      created_at: now,
      updated_at: now
    };
    webJawsStore.workOrders.unshift(newWo);
    existingWoNumbers.add(woNum.toLowerCase());
    inserted++;
  }
  webJawsStore.addAuditLog({
    user_id: req.user.id,
    user_name: req.user.full_name,
    role: req.user.role,
    activity: "IMPORT_WORK_ORDERS",
    module: "Import WO",
    record_id: batchId,
    diff_data: { batchId, fileName, inserted, skipped, method: importMethod },
    ip_address: getClientIp(req)
  });
  return res.json({
    success: true,
    message: `Import confirmed: ${inserted} Work Orders successfully committed into WebJaws database. (${skipped} duplicates skipped)`,
    batchId,
    insertedCount: inserted,
    skippedCount: skipped
  });
});

// server/routes/contactRoutes.ts
import { Router as Router6 } from "express";
import crypto6 from "crypto";
var contactRouter = Router6();
contactRouter.use(requireAuth);
contactRouter.get("/messages", (req, res) => {
  const { wo_number, unread_only } = req.query;
  const user = req.user;
  let messages = [...webJawsStore.ticketMessages];
  if (wo_number && typeof wo_number === "string") {
    messages = messages.filter((m) => m.wo_number && m.wo_number.toLowerCase() === wo_number.toLowerCase());
  }
  if (unread_only === "true") {
    messages = messages.filter((m) => !m.is_read && m.sender_id !== user.id);
  }
  const unreadCount = webJawsStore.ticketMessages.filter((m) => !m.is_read && m.sender_id !== user.id).length;
  const threadsMap = {};
  webJawsStore.ticketMessages.forEach((m) => {
    const key = m.wo_number || "GENERAL";
    if (!threadsMap[key]) {
      threadsMap[key] = {
        wo_number: key,
        latestMessage: m,
        count: 1,
        unread: !m.is_read && m.sender_id !== user.id
      };
    } else {
      threadsMap[key].count++;
      if (new Date(m.created_at) > new Date(threadsMap[key].latestMessage.created_at)) {
        threadsMap[key].latestMessage = m;
      }
      if (!m.is_read && m.sender_id !== user.id) {
        threadsMap[key].unread = true;
      }
    }
  });
  return res.json({
    success: true,
    total: messages.length,
    unreadCount,
    threads: Object.values(threadsMap),
    messages
  });
});
contactRouter.post("/messages", (req, res) => {
  const user = req.user;
  const { wo_number, message, attachment_url, attachment_name } = req.body;
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: "Message text cannot be empty" });
  }
  let wo_id;
  if (wo_number) {
    const wo = webJawsStore.workOrders.find((w) => w.wo_number === wo_number.trim());
    if (wo) wo_id = wo.id;
  }
  const newMessage = {
    id: crypto6.randomUUID(),
    wo_id,
    wo_number: wo_number ? wo_number.trim() : void 0,
    sender_id: user.id,
    sender_name: user.full_name,
    sender_role: user.role,
    message: message.trim(),
    attachment_url: attachment_url || void 0,
    attachment_name: attachment_name || void 0,
    is_read: false,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  webJawsStore.ticketMessages.push(newMessage);
  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: "SEND_LIVECHAT_MESSAGE",
    module: "Contact Center",
    record_id: newMessage.id,
    diff_data: { wo_number, hasAttachment: !!attachment_url },
    ip_address: getClientIp(req)
  });
  return res.status(201).json({
    success: true,
    message: "Message sent successfully",
    chatMessage: newMessage
  });
});
contactRouter.patch("/messages/:id/read", (req, res) => {
  const { id } = req.params;
  const msg = webJawsStore.ticketMessages.find((m) => m.id === id);
  if (!msg) {
    return res.status(404).json({ success: false, error: "Message not found" });
  }
  msg.is_read = true;
  return res.json({
    success: true,
    message: "Message marked as read"
  });
});

// server/routes/systemRoutes.ts
import { Router as Router7 } from "express";

// server/db/migrate.ts
import fs2 from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function runMigrations() {
  const start = Date.now();
  const status = await checkConnection();
  if (!status.connected || !pool) {
    return {
      success: false,
      message: "Migration BLOCKED: real PostgreSQL connection is unavailable. No in-memory migration is performed.",
      tablesCreated: [],
      durationMs: Date.now() - start,
      dbType: "unavailable",
      error: status.error || "DATABASE_URL is not configured"
    };
  }
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs2.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }
  const migrationFiles = fs2.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  if (migrationFiles.length === 0) {
    throw new Error("No migration files found in migrations directory");
  }
  const client = await pool.connect();
  const appliedMigrations = [];
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const appliedRes = await client.query("SELECT version FROM schema_migrations");
    const alreadyApplied = new Set(appliedRes.rows.map((r) => r.version));
    for (const file of migrationFiles) {
      if (alreadyApplied.has(file)) {
        continue;
      }
      const filePath = path.join(migrationsDir, file);
      const sql = fs2.readFileSync(filePath, "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      appliedMigrations.push(file);
    }
    const result = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = result.rows.map((row) => row.table_name);
    const required = [
      "roles",
      "permissions",
      "role_permissions",
      "staff_users",
      "auth_sessions",
      "work_orders",
      "wo_status_history",
      "ticket_messages",
      "notifications",
      "wo_import_batches",
      "wo_import_errors",
      "dropdown_options",
      "app_config_versions",
      "audit_logs"
    ];
    const missing = required.filter((name) => !tables.includes(name));
    if (missing.length) {
      throw new Error(`Schema verification failed. Missing tables: ${missing.join(", ")}`);
    }
    await client.query("COMMIT");
    return {
      success: true,
      message: `Migrations applied successfully (${appliedMigrations.length} new, ${tables.length} tables verified).`,
      tablesCreated: tables,
      appliedMigrations,
      durationMs: Date.now() - start,
      dbType: "supabase_postgres"
    };
  } catch (error) {
    await client.query("ROLLBACK");
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      tablesCreated: [],
      appliedMigrations: [],
      durationMs: Date.now() - start,
      dbType: "supabase_postgres",
      error: error.message
    };
  } finally {
    client.release();
  }
}
if (process.argv[1] && (process.argv[1].endsWith("migrate.ts") || process.argv[1].endsWith("migrate.js"))) {
  runMigrations().then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.success ? 0 : 1);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// server/routes/systemRoutes.ts
var systemRouter = Router7();
systemRouter.get("/health", async (req, res) => {
  const dbStatus = await checkConnection();
  const uptimeSeconds = process.uptime();
  let totalStaff = 0;
  let activeSessions = 0;
  let auditLogsCount = 0;
  if (dbStatus.connected) {
    try {
      const staffRes = await query("SELECT COUNT(*)::int AS count FROM staff_users");
      totalStaff = staffRes.rows[0]?.count || 0;
      const sessionsRes = await query("SELECT COUNT(*)::int AS count FROM auth_sessions WHERE expires_at > NOW()");
      activeSessions = sessionsRes.rows[0]?.count || 0;
      const auditRes = await query("SELECT COUNT(*)::int AS count FROM audit_logs");
      auditLogsCount = auditRes.rows[0]?.count || 0;
    } catch {
    }
  }
  return res.json({
    success: dbStatus.connected,
    status: dbStatus.connected ? "online" : "degraded",
    platform: "WebJaws Integrated Operations Platform",
    version: "1.1.0 (PostgreSQL Auth & Supabase Storage)",
    uptimeSeconds,
    database: dbStatus,
    stats: {
      totalStaff,
      activeSessions,
      totalWorkOrders: webJawsStore.workOrders.length,
      auditLogsCount,
      configVersion: webJawsStore.activeConfig.version
    }
  });
});
systemRouter.use(requireAuth);
systemRouter.post("/migrate", requireRole(["Superadmin", "IT Support Application"]), async (req, res) => {
  try {
    const result = await runMigrations();
    return res.json({
      success: result.success,
      result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `Migration error: ${err.message}`
    });
  }
});
systemRouter.get("/audit-logs", requireRole(["Superadmin"]), async (req, res) => {
  const { module, user_id, search, limit = "100" } = req.query;
  const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 100));
  try {
    let sql = `
      SELECT id, user_id, user_name, role, activity, module, record_id, diff_data, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE 1=1
    `;
    const params = [];
    if (module && typeof module === "string") {
      params.push(module);
      sql += ` AND LOWER(module) = LOWER($${params.length})`;
    }
    if (user_id && typeof user_id === "string") {
      params.push(user_id);
      sql += ` AND user_id = $${params.length}`;
    }
    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (
        LOWER(activity) LIKE $${params.length} OR
        LOWER(user_name) LIKE $${params.length} OR
        LOWER(module) LIKE $${params.length} OR
        LOWER(COALESCE(record_id, '')) LIKE $${params.length}
      )`;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limitNum);
    const result = await query(sql, params);
    return res.json({
      success: true,
      total: result.rowCount,
      logs: result.rows
    });
  } catch (err) {
    console.error("Audit logs query error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to retrieve audit logs" });
  }
});

// server/routes/setupRoutes.ts
import { Router as Router8 } from "express";
import crypto7 from "crypto";
import bcrypt4 from "bcryptjs";
var setupRouter = Router8();
function safeEqual(a, b) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto7.timingSafeEqual(aa, bb);
}
setupRouter.get("/status", async (_req, res) => {
  if (!pool) return res.status(503).json({ success: false, available: false, error: "Database is unavailable" });
  try {
    const result = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM staff_users WHERE role = 'Superadmin') AS has_superadmin"
    );
    const hasSuperadmin = Boolean(result.rows[0]?.has_superadmin);
    return res.json({ success: true, available: !hasSuperadmin });
  } catch {
    return res.status(503).json({ success: false, available: false, error: "Unable to check setup status" });
  }
});
setupRouter.post("/superadmin", async (req, res) => {
  const setupToken = process.env.WEBJAWS_SETUP_TOKEN || "";
  const suppliedToken = typeof req.body?.setupToken === "string" ? req.body.setupToken : "";
  if (!setupToken || !suppliedToken || !safeEqual(setupToken, suppliedToken)) {
    return res.status(403).json({ success: false, error: "Setup authorization failed" });
  }
  if (!pool) return res.status(503).json({ success: false, error: "Database is unavailable" });
  const { fullName, username, email, password } = req.body || {};
  if (![fullName, username, email, password].every((v) => typeof v === "string" && v.trim())) {
    return res.status(400).json({ success: false, error: "All fields are required" });
  }
  if (fullName.trim().length > 128 || username.trim().length < 3 || username.trim().length > 64 || email.trim().length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, error: "Please check name, username, and email format" });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: "Password must be 12\u2013128 characters" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('webjaws_first_superadmin_setup'))");
    const existing = await client.query("SELECT 1 FROM staff_users WHERE role = 'Superadmin' LIMIT 1");
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, error: "A Superadmin already exists. Initial setup is closed." });
    }
    await client.query(
      `INSERT INTO roles (id, name, description, is_system)
       VALUES ('Superadmin', 'Superadmin', 'Initial WebJaws system administrator', TRUE)
       ON CONFLICT (id) DO NOTHING`
    );
    const passwordHash = await bcrypt4.hash(password, 12);
    const inserted = await client.query(
      `INSERT INTO staff_users (username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'Superadmin', TRUE)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username.trim(), email.trim().toLowerCase(), passwordHash, fullName.trim()]
    );
    const user = inserted.rows[0];
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, role, activity, module, record_id, ip_address, user_agent)
       VALUES ($1, $2, 'Superadmin', 'INITIAL_SUPERADMIN_CREATED', 'Authentication', $3, $4, $5)`,
      [user.id, user.full_name, user.username, req.ip, req.headers["user-agent"] || null]
    );
    await client.query("COMMIT");
    return res.status(201).json({ success: true, message: "Initial Superadmin created. You can now sign in.", user });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") return res.status(409).json({ success: false, error: "Username or email is already registered" });
    console.error("Initial Superadmin setup failed:", error?.message || "Unknown error");
    return res.status(500).json({ success: false, error: "Unable to create initial Superadmin" });
  } finally {
    client.release();
  }
});

// server/auth/csrf.ts
var SAFE_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
function getCanonicalOrigin(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return {
      protocol: parsed.protocol,
      // e.g. "http:" or "https:"
      host: parsed.host,
      // e.g. "127.0.0.1:3000" or "example.com"
      origin: parsed.origin
      // e.g. "http://127.0.0.1:3000"
    };
  } catch {
    return null;
  }
}
function isTrustedOrigin(candidateOriginStr, req) {
  const candidate = getCanonicalOrigin(candidateOriginStr);
  if (!candidate) return false;
  const reqHost = req.get("host");
  if (!reqHost) return false;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const expectedProto = typeof forwardedProto === "string" ? `${forwardedProto.split(",")[0].trim().toLowerCase()}:` : `${req.protocol.toLowerCase()}:`;
  const isProd2 = process.env.NODE_ENV === "production";
  const isLocalCandidate = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(candidate.host);
  if (isProd2 && !isLocalCandidate && candidate.protocol !== "https:") {
    return false;
  }
  if (candidate.host.toLowerCase() === reqHost.toLowerCase()) {
    if (isProd2 && !isLocalCandidate) {
      return candidate.protocol === "https:";
    }
    return candidate.protocol === expectedProto || candidate.protocol === "http:" || candidate.protocol === "https:";
  }
  if (!isProd2 || isLocalCandidate) {
    const [candidateHostname, candidatePort = candidate.protocol === "https:" ? "443" : "80"] = candidate.host.split(":");
    const [reqHostname, reqPort = expectedProto === "https:" ? "443" : "80"] = reqHost.split(":");
    const loopbackIps = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
    if (loopbackIps.has(candidateHostname.toLowerCase()) && loopbackIps.has(reqHostname.toLowerCase())) {
      if (candidatePort === reqPort) {
        return true;
      }
    }
  }
  const configuredAllowed = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    ...process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []
  ].filter(Boolean);
  for (const allowedStr of configuredAllowed) {
    const allowed = getCanonicalOrigin(allowedStr.trim());
    if (allowed && allowed.origin.toLowerCase() === candidate.origin.toLowerCase()) {
      return true;
    }
  }
  return false;
}
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }
  const originHeader = req.headers["origin"];
  const refererHeader = req.headers["referer"];
  if (!originHeader && !refererHeader) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: Missing Origin or Referer header on state-changing request",
      code: "CSRF_BLOCKED"
    });
  }
  if (typeof originHeader === "string" && originHeader.trim()) {
    if (!isTrustedOrigin(originHeader.trim(), req)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cross-Site Request Forgery (CSRF) detected from origin ${originHeader}`,
        code: "CSRF_BLOCKED"
      });
    }
    return next();
  }
  if (typeof refererHeader === "string" && refererHeader.trim()) {
    const refererOrigin = getCanonicalOrigin(refererHeader.trim());
    if (!refererOrigin || !isTrustedOrigin(refererOrigin.origin, req)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cross-Site Request Forgery (CSRF) detected from referer ${refererHeader}`,
        code: "CSRF_BLOCKED"
      });
    }
    return next();
  }
  return res.status(403).json({
    success: false,
    error: "Forbidden: Invalid Origin or Referer header",
    code: "CSRF_BLOCKED"
  });
}

// server.ts
dotenv2.config({ override: true });
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var app = express();
var port = parseInt(process.env.PORT || "3000", 10);
var isProd = process.env.NODE_ENV === "production";
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(cookieParser());
app.use("/api", csrfProtection);
app.use("/api/setup", setupRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/config", configRouter);
app.use("/api/work-orders", woRouter);
app.use("/api/import", importRouter);
app.use("/api/contact", contactRouter);
app.use("/api/system", systemRouter);
app.use("/api", (err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(__dirname2, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path2.resolve(distPath, "index.html"));
    });
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`[WebJaws Platform] Server running on http://0.0.0.0:${port}`);
    console.log(`[WebJaws Platform] Architecture: Full-Stack React + TypeScript + Express + PostgreSQL`);
  });
}
startServer().catch((err) => {
  console.error("Fatal error starting WebJaws server:", err);
  process.exit(1);
});
