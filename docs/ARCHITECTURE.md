# WebJaws — Integrated Operations & Ticket Management Platform
## Architecture & Technical Specification — Session 1 Baseline

### 1. System Overview
WebJaws is a full-stack integrated operations management system designed for telecommunication & fiber-optic Work Order (WO) distribution, Agent Dispatch coordination, Leader contractor supervision, Installer field execution, LiveChat communication, and centralized Superadmin administration.

### 2. Technology Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React icons, Motion animations.
- **Backend**: Node.js, Express 4.x, TypeScript (`tsx`).
- **Database**: PostgreSQL (Supabase Connection Pooling / Direct Connection via `pg.Pool`).
- **Authentication**: WebJaws Custom Internal Authentication (no Supabase Auth dependency), HttpOnly secure session cookies, PBKDF2/bcrypt password hashing, brute-force rate limiter.
- **Access Control**: Role-Based Access Control (RBAC) enforced server-side.

### 3. Roles & Permission Model
1. **Superadmin**: Full administrative privileges across all modules, configuration versioning, droplist management, staff accounts, audit logs, and migration execution.
2. **Agent Dispatch**: WO distribution, review and approval of installer reports, pending/reschedule processing, LiveChat with installers.
3. **Leader**: Area and contractor boundary enforcement. Manages installer assignments and monitors field progress.
4. **Installer**: Mobile-first field hub. Sees assigned tickets, submits progress reports (Done, Pending, Reschedule) with reason/rootcause, sends WhatsApp confirmation.
5. **Monitoring Data**: Read-only access to operational dashboard, metrics, and reporting.
6. **IT Support Application**: Application health diagnostics, connection testing, and authorized system tools.

### 4. Database Schema (Supabase PostgreSQL)
- `staff_users`: Staff accounts, roles, contractors, areas, active flags.
- `auth_sessions`: Server-side session tokens with expiry tracking.
- `login_attempts`: Rate limiting and brute force protection.
- `roles`, `permissions`, `role_permissions`: Granular capability mapping.
- `work_orders`: 44 baseline attributes + system operational metadata.
- `wo_status_history`: Complete audit trail of agent and installer state transitions.
- `ticket_messages` & `ticket_attachments`: Real-time LiveChat linked to WO Number.
- `dropdown_options`: Centralized choices for statuses, reasons, contractors, areas, slot times.
- `app_config_versions`: Version-controlled global settings with 1-click rollback.
- `audit_logs`: Immutable security logging for administrative and operational events.

### 5. Import WO & Text-to-Table Engine
- 4 methods: Upload Excel (`.xlsx`), Upload CSV (`.csv`), Paste Text, Text-to-Table.
- Automatic delimiter detector (Tab, Comma, Semicolon, Pipe).
- Recognition of the 44 baseline headers specified in WebJaws requirements.
- Pre-import validation: missing mandatory fields, duplicate detection against database and batch.
- Detailed error logging per row and preview table.
