-- ====================================================================
-- WEBJAWS INITIAL SCHEMA MIGRATION 001
-- Integrated Operations & Ticket Management Platform
-- Target Database: Supabase PostgreSQL
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. ROLES AND PERMISSIONS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(64) PRIMARY KEY,
  module VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(32) REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(64) REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- --------------------------------------------------------------------
-- 2. STAFF USERS (Custom Auth - No Supabase Auth)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  role VARCHAR(32) REFERENCES roles(id) NOT NULL,
  contractor_name VARCHAR(128),
  area VARCHAR(128),
  phone VARCHAR(32),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_username ON staff_users(username);
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_role ON staff_users(role);

-- --------------------------------------------------------------------
-- 3. AUTH SESSIONS (Server-side Session Store)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(128) UNIQUE NOT NULL,
  user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- --------------------------------------------------------------------
-- 4. LOGIN ATTEMPTS (Brute-Force Rate Limiting)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  success BOOLEAN NOT NULL,
  attempt_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_time ON login_attempts(identifier, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempt_time);

-- --------------------------------------------------------------------
-- 5. PASSWORD RESET TOKENS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE NOT NULL,
  token VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 6. CONTRACTORS AND AREAS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  contact_person VARCHAR(128),
  phone VARCHAR(32),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractor_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_name VARCHAR(128) NOT NULL,
  area_name VARCHAR(128) NOT NULL,
  cluster_names TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractor_areas ON contractor_areas(contractor_name, area_name);

-- --------------------------------------------------------------------
-- 7. WORK ORDERS (Baseline 44 Header Schema + Operational Meta)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number VARCHAR(64) UNIQUE NOT NULL,
  
  -- The 44 Standard WebJaws / MoraJaws Schema Columns
  date DATE,
  file_name VARCHAR(255),
  date_upload TIMESTAMPTZ DEFAULT NOW(),
  date_assign_agent TIMESTAMPTZ,
  date_assign_teknisi TIMESTAMPTZ,
  agent_id VARCHAR(64),
  id_customer VARCHAR(64),
  customer_name VARCHAR(128),
  customer_phone VARCHAR(32),
  customer_phone2 VARCHAR(32),
  customer_phone3 VARCHAR(32),
  contactor_name VARCHAR(128),
  area VARCHAR(128),
  installer_name VARCHAR(128),
  slot_time VARCHAR(64),
  street_name TEXT,
  street_alternatif TEXT,
  cluster_name VARCHAR(128),
  fdt_code VARCHAR(64),
  fat_code VARCHAR(64),
  ticket_number VARCHAR(64),
  ticket_category VARCHAR(64),
  date_report_agent TIMESTAMPTZ,
  status_wo_agent VARCHAR(32) DEFAULT 'Unhandled',
  reason_wo_agent VARCHAR(128),
  rootcause_wo_agent VARCHAR(128),
  remarks_wo_agent TEXT,
  date_report_installer TIMESTAMPTZ,
  date_report_installer2 TIMESTAMPTZ,
  status_wo_installer VARCHAR(32) DEFAULT 'Unhandled',
  reason_wo_installer VARCHAR(128),
  rootcause_wo_installer VARCHAR(128),
  remarks_wo_installer TEXT,
  destination_call VARCHAR(64),
  reason_call VARCHAR(128),
  remarks_call TEXT,
  agent_ta VARCHAR(64),
  status_ta VARCHAR(64),
  remarks_ta TEXT,
  flag VARCHAR(64),
  agent_ret VARCHAR(64),
  status_ret VARCHAR(64),
  remarks_ret TEXT,

  -- System Operational Metadata
  system_status VARCHAR(32) DEFAULT 'Requested' NOT NULL, -- 'Requested', 'Assigned', 'In Progress', 'Completed', 'Archived'
  assigned_leader_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_installer_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  import_batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_number ON work_orders(wo_number);
CREATE INDEX IF NOT EXISTS idx_wo_date ON work_orders(date);
CREATE INDEX IF NOT EXISTS idx_wo_contactor ON work_orders(contactor_name);
CREATE INDEX IF NOT EXISTS idx_wo_area ON work_orders(area);
CREATE INDEX IF NOT EXISTS idx_wo_agent_status ON work_orders(status_wo_agent);
CREATE INDEX IF NOT EXISTS idx_wo_installer_status ON work_orders(status_wo_installer);
CREATE INDEX IF NOT EXISTS idx_wo_system_status ON work_orders(system_status);
CREATE INDEX IF NOT EXISTS idx_wo_assigned_installer ON work_orders(assigned_installer_id);
CREATE INDEX IF NOT EXISTS idx_wo_assigned_leader ON work_orders(assigned_leader_id);

-- --------------------------------------------------------------------
-- 8. STATUS HISTORY & AUDIT TRAIL
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wo_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id UUID REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  wo_number VARCHAR(64) NOT NULL,
  changed_by_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  changed_by_name VARCHAR(128),
  role VARCHAR(32),
  previous_agent_status VARCHAR(32),
  new_agent_status VARCHAR(32),
  previous_installer_status VARCHAR(32),
  new_installer_status VARCHAR(32),
  previous_system_status VARCHAR(32),
  new_system_status VARCHAR(32),
  reason VARCHAR(255),
  rootcause VARCHAR(255),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_status_history_wo_id ON wo_status_history(wo_id);

-- --------------------------------------------------------------------
-- 9. LIVECHAT / CONTACT CENTER TICKETS & ATTACHMENTS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  wo_number VARCHAR(64),
  sender_id UUID REFERENCES staff_users(id) ON DELETE SET NULL NOT NULL,
  sender_name VARCHAR(128) NOT NULL,
  sender_role VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_wo_number ON ticket_messages(wo_number);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON ticket_messages(sender_id);

-- --------------------------------------------------------------------
-- 10. NOTIFICATIONS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(128) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(32) DEFAULT 'info',
  link VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- --------------------------------------------------------------------
-- 11. IMPORT BATCHES AND ERRORS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wo_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255) NOT NULL,
  import_method VARCHAR(32) NOT NULL, -- 'excel', 'csv', 'paste_text', 'text_to_table'
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  imported_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  imported_by_name VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wo_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES wo_import_batches(id) ON DELETE CASCADE NOT NULL,
  row_index INTEGER NOT NULL,
  raw_data JSONB,
  error_field VARCHAR(64),
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 12. DROPDOWN CONFIGURATION
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dropdown_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(64) NOT NULL,
  label VARCHAR(128) NOT NULL,
  value VARCHAR(128) NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dropdown_category ON dropdown_options(category, order_index);

-- --------------------------------------------------------------------
-- 13. CENTRALIZED APP CONFIGURATION & VERSIONING
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_config_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL,
  title VARCHAR(128) NOT NULL,
  config_data JSONB NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES staff_users(id),
  created_by_name VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_version_number ON app_config_versions(version_number DESC);

-- --------------------------------------------------------------------
-- 14. AUDIT LOGS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name VARCHAR(128),
  role VARCHAR(32),
  activity VARCHAR(128) NOT NULL,
  module VARCHAR(64) NOT NULL,
  record_id VARCHAR(128),
  diff_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
