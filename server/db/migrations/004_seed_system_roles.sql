-- ====================================================================
-- WEBJAWS MIGRATION 004: Seed System Roles & Initial Permissions
-- Target Database: Supabase PostgreSQL
-- Seeds standard WebJaws roles into roles table
-- ====================================================================

INSERT INTO roles (id, name, description, is_system)
VALUES
  ('Superadmin', 'Superadmin', 'Full system access, administration, and user management', TRUE),
  ('Agent Dispatch', 'Agent Dispatch', 'Ticket dispatch, assignment, and agent reporting', TRUE),
  ('Leader', 'Leader', 'Field coordinator and contractor technician lead', TRUE),
  ('Installer', 'Installer', 'Field technician performing on-site installations', TRUE),
  ('Monitoring Data', 'Monitoring Data', 'Operations monitoring, data analysis, and reporting', TRUE),
  ('IT Support Application', 'IT Support Application', 'Application support and user assistance', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- Seed baseline permissions
INSERT INTO permissions (id, module, action, description)
VALUES
  ('users:view', 'Management User', 'view', 'View staff user accounts'),
  ('users:create', 'Management User', 'create', 'Create new staff user accounts'),
  ('users:edit', 'Management User', 'edit', 'Edit staff user account details'),
  ('users:delete', 'Management User', 'delete', 'Delete staff user accounts'),
  ('users:reset_password', 'Management User', 'reset_password', 'Reset staff user password'),
  ('wo:view', 'Management WO', 'view', 'View work orders'),
  ('wo:import', 'Management WO', 'import', 'Import work orders from Excel/Text'),
  ('wo:update_status', 'Management WO', 'update_status', 'Update work order status'),
  ('contact:view', 'Contact Center', 'view', 'View livechat and contact tickets'),
  ('contact:send', 'Contact Center', 'send', 'Send contact messages')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Superadmin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'Superadmin', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;
