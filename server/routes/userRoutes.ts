import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, checkConnection } from '../db/db.js';
import {
  AuthenticatedRequest,
  requireAuth,
  requireRole,
  getClientIp,
  revokeAllUserSessions,
  addPostgresAuditLog,
} from '../auth/auth.js';

export const userRouter = Router();

// All user management routes strictly require authentication
userRouter.use(requireAuth);

const VALID_ROLES = [
  'Superadmin',
  'Agent Dispatch',
  'Leader',
  'Installer',
  'Monitoring Data',
  'IT Support Application',
];

// Helper: Ensure PostgreSQL is connected, fail closed otherwise
async function ensureDbConnected(res: Response): Promise<boolean> {
  const dbStatus = await checkConnection();
  if (!dbStatus.connected) {
    res.status(503).json({
      success: false,
      error: 'Database is unavailable. User management requires a live PostgreSQL connection.',
      code: 'DATABASE_UNAVAILABLE',
    });
    return false;
  }
  return true;
}

// GET /api/users/roles - List all roles from PostgreSQL roles table
userRouter.get('/roles', requireRole(['Superadmin', 'IT Support Application']), async (_req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  try {
    const result = await query(
      'SELECT id, name, description, is_system FROM roles ORDER BY id ASC'
    );
    return res.json({
      success: true,
      roles: result.rows,
    });
  } catch (err: any) {
    console.error('List roles error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve roles' });
  }
});

// GET /api/users - List all staff users from PostgreSQL staff_users
userRouter.get('/', requireRole(['Superadmin', 'IT Support Application']), async (req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  const { role, is_active, search } = req.query;

  try {
    let sql = `
      SELECT id, username, email, full_name, role, contractor_name, area, phone, avatar_url,
             is_active, last_login_at, created_at, updated_at
      FROM staff_users
      WHERE 1=1
    `;
    const params: any[] = [];

    if (role && typeof role === 'string' && role.trim()) {
      params.push(role.trim());
      sql += ` AND role = $${params.length}`;
    }

    if (is_active !== undefined) {
      const activeBool = is_active === 'true' || is_active === '1';
      params.push(activeBool);
      sql += ` AND is_active = $${params.length}`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      sql += ` AND (
        LOWER(username) LIKE $${params.length} OR
        LOWER(full_name) LIKE $${params.length} OR
        LOWER(email) LIKE $${params.length} OR
        LOWER(COALESCE(contractor_name, '')) LIKE $${params.length} OR
        LOWER(COALESCE(area, '')) LIKE $${params.length} OR
        LOWER(COALESCE(phone, '')) LIKE $${params.length}
      )`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      contractor_name: row.contractor_name || undefined,
      area: row.area || undefined,
      phone: row.phone || undefined,
      avatar_url: row.avatar_url || undefined,
      is_active: Boolean(row.is_active),
      last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    }));

    return res.json({
      success: true,
      total: users.length,
      users,
    });
  } catch (err: any) {
    console.error('List users error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve staff users' });
  }
});

// GET /api/users/:id - Get staff user details by ID from PostgreSQL
userRouter.get('/:id', requireRole(['Superadmin', 'IT Support Application']), async (req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, username, email, full_name, role, contractor_name, area, phone, avatar_url,
              is_active, last_login_at, created_at, updated_at
       FROM staff_users
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Staff user not found' });
    }

    const row = result.rows[0];
    const safeUser = {
      id: row.id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      contractor_name: row.contractor_name || undefined,
      area: row.area || undefined,
      phone: row.phone || undefined,
      avatar_url: row.avatar_url || undefined,
      is_active: Boolean(row.is_active),
      last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };

    return res.json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Get user details error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve staff user details' });
  }
});

// POST /api/users - Create new staff account in PostgreSQL (Superadmin only)
userRouter.post('/', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  const { username, email, password, full_name, role, contractor_name, area, phone } = req.body || {};

  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({
      success: false,
      error: 'Fields username, email, password, full_name, and role are required',
    });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanFullName = String(full_name).trim();
  const cleanRole = String(role).trim();

  if (cleanUsername.length < 3 || cleanUsername.length > 64 || !/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
    return res.status(400).json({
      success: false,
      error: 'Username must be 3–64 characters and contain only letters, numbers, dots, dashes, or underscores',
    });
  }

  if (cleanEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid email address',
    });
  }

  if (cleanFullName.length < 2 || cleanFullName.length > 128) {
    return res.status(400).json({
      success: false,
      error: 'Full name must be 2–128 characters',
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters long',
    });
  }

  // Validate role against PostgreSQL roles table
  const roleCheck = await query('SELECT id FROM roles WHERE id = $1', [cleanRole]);
  if (roleCheck.rowCount === 0) {
    return res.status(400).json({
      success: false,
      error: `Invalid role '${cleanRole}'. Must be a registered role in the system.`,
    });
  }

  // Security policy: non-Superadmin cannot create Superadmin
  if (req.user!.role !== 'Superadmin' && cleanRole === 'Superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Only Superadmin can assign the Superadmin role',
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  }

  try {
    // Check unique username and email in PostgreSQL
    const existing = await query(
      'SELECT id FROM staff_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1',
      [cleanUsername, cleanEmail]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({
        success: false,
        error: 'A user with this username or email already exists',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertRes = await query(
      `INSERT INTO staff_users (
        username, email, password_hash, full_name, role, contractor_name, area, phone, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
      RETURNING id, username, email, full_name, role, contractor_name, area, phone, avatar_url, is_active, created_at, updated_at`,
      [
        cleanUsername,
        cleanEmail,
        passwordHash,
        cleanFullName,
        cleanRole,
        contractor_name ? String(contractor_name).trim() : null,
        area ? String(area).trim() : null,
        phone ? String(phone).trim() : null,
      ]
    );

    const newUser = insertRes.rows[0];

    await addPostgresAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      role: req.user!.role,
      activity: 'CREATE_STAFF_USER',
      module: 'Management User',
      record_id: newUser.id,
      diff_data: {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        contractor: newUser.contractor_name,
        area: newUser.area,
        phone: newUser.phone,
      },
      ip_address: getClientIp(req),
      user_agent: (req.headers['user-agent'] as string) || undefined,
    });

    return res.status(201).json({
      success: true,
      message: `Staff user '${newUser.username}' created successfully`,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        contractor_name: newUser.contractor_name || undefined,
        area: newUser.area || undefined,
        phone: newUser.phone || undefined,
        is_active: newUser.is_active,
        created_at: new Date(newUser.created_at).toISOString(),
        updated_at: new Date(newUser.updated_at).toISOString(),
      },
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ success: false, error: 'Username or email already exists' });
    }
    console.error('Create user error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create staff user in database' });
  }
});

// PUT /api/users/:id - Update staff account details & role in PostgreSQL (Superadmin only)
userRouter.put('/:id', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  const { id } = req.params;
  const { full_name, email, role, contractor_name, area, phone, password } = req.body || {};

  try {
    const userRes = await query('SELECT * FROM staff_users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Staff user not found' });
    }

    const currentStaff = userRes.rows[0];

    // Security policy: user cannot modify own role
    if (id === req.user!.id && role && role !== req.user!.role) {
      return res.status(400).json({
        success: false,
        error: 'You cannot change your own role',
      });
    }

    // Role validation against PostgreSQL roles table
    let updatedRole = currentStaff.role;
    let roleChanged = false;

    if (role && typeof role === 'string' && role.trim()) {
      const cleanRole = role.trim();
      if (!VALID_ROLES.includes(cleanRole)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role '${cleanRole}'`,
        });
      }

      const roleDbCheck = await query('SELECT id FROM roles WHERE id = $1', [cleanRole]);
      if (roleDbCheck.rowCount === 0) {
        return res.status(400).json({
          success: false,
          error: `Role '${cleanRole}' does not exist in database`,
        });
      }

      if (cleanRole !== currentStaff.role) {
        // Prevent demoting the last active Superadmin
        if (currentStaff.role === 'Superadmin' && cleanRole !== 'Superadmin') {
          const activeSuperadmins = await query(
            "SELECT COUNT(*)::int AS count FROM staff_users WHERE role = 'Superadmin' AND is_active = TRUE"
          );
          if ((activeSuperadmins.rows[0]?.count || 0) <= 1) {
            return res.status(400).json({
              success: false,
              error: 'Cannot demote the last remaining active Superadmin',
            });
          }
        }
        updatedRole = cleanRole;
        roleChanged = true;
      }
    }

    // Email validation and uniqueness check if email changed
    let updatedEmail = currentStaff.email;
    if (email && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== currentStaff.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          return res.status(400).json({ success: false, error: 'Invalid email format' });
        }
        const dupEmail = await query(
          'SELECT id FROM staff_users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
          [cleanEmail, id]
        );
        if (dupEmail.rowCount && dupEmail.rowCount > 0) {
          return res.status(409).json({ success: false, error: 'Email is already in use by another user' });
        }
        updatedEmail = cleanEmail;
      }
    }

    const updatedFullName = full_name ? String(full_name).trim() : currentStaff.full_name;
    const updatedContractor =
      contractor_name !== undefined ? (contractor_name ? String(contractor_name).trim() : null) : currentStaff.contractor_name;
    const updatedArea = area !== undefined ? (area ? String(area).trim() : null) : currentStaff.area;
    const updatedPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : currentStaff.phone;

    // Password update handling: only update if provided and non-empty
    let passwordUpdated = false;
    if (password && typeof password === 'string' && password.trim().length > 0) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long' });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await query('UPDATE staff_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, id]);
      passwordUpdated = true;
    }

    const updateRes = await query(
      `UPDATE staff_users
       SET full_name = $1, email = $2, role = $3, contractor_name = $4, area = $5, phone = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id, username, email, full_name, role, contractor_name, area, phone, avatar_url, is_active, last_login_at, created_at, updated_at`,
      [updatedFullName, updatedEmail, updatedRole, updatedContractor, updatedArea, updatedPhone, id]
    );

    const safeUser = updateRes.rows[0];

    // If role changed or password was updated, revoke all active sessions for this user in PostgreSQL
    if (roleChanged || passwordUpdated) {
      await revokeAllUserSessions(id);
    }

    await addPostgresAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      role: req.user!.role,
      activity: roleChanged ? 'CHANGE_USER_ROLE' : 'UPDATE_STAFF_USER',
      module: 'Management User',
      record_id: id,
      diff_data: {
        full_name: safeUser.full_name,
        email: safeUser.email,
        role: safeUser.role,
        contractor_name: safeUser.contractor_name,
        area: safeUser.area,
        role_changed: roleChanged,
        password_updated: passwordUpdated,
      },
      ip_address: getClientIp(req),
      user_agent: (req.headers['user-agent'] as string) || undefined,
    });

    return res.json({
      success: true,
      message: 'Staff user updated successfully',
      user: {
        id: safeUser.id,
        username: safeUser.username,
        email: safeUser.email,
        full_name: safeUser.full_name,
        role: safeUser.role,
        contractor_name: safeUser.contractor_name || undefined,
        area: safeUser.area || undefined,
        phone: safeUser.phone || undefined,
        avatar_url: safeUser.avatar_url || undefined,
        is_active: safeUser.is_active,
        last_login_at: safeUser.last_login_at ? new Date(safeUser.last_login_at).toISOString() : undefined,
        created_at: new Date(safeUser.created_at).toISOString(),
        updated_at: new Date(safeUser.updated_at).toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Update user error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update staff user' });
  }
});

// PATCH /api/users/:id/status - Toggle active/inactive in PostgreSQL (Superadmin only)
userRouter.patch('/:id/status', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  const { id } = req.params;
  const { is_active } = req.body || {};

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'is_active must be a boolean' });
  }

  try {
    const userRes = await query('SELECT id, username, role, is_active FROM staff_users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Staff user not found' });
    }

    const targetUser = userRes.rows[0];

    // Security policy: user cannot deactivate their own account
    if (id === req.user!.id && !is_active) {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
    }

    // Security policy: cannot deactivate the last remaining active Superadmin
    if (targetUser.role === 'Superadmin' && !is_active) {
      const activeSuperadmins = await query(
        "SELECT COUNT(*)::int AS count FROM staff_users WHERE role = 'Superadmin' AND is_active = TRUE"
      );
      if ((activeSuperadmins.rows[0]?.count || 0) <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot deactivate the last remaining active Superadmin',
        });
      }
    }

    await query('UPDATE staff_users SET is_active = $1, updated_at = NOW() WHERE id = $2', [is_active, id]);

    // When deactivated, revoke all active sessions immediately from PostgreSQL
    if (!is_active) {
      await revokeAllUserSessions(id);
    }

    await addPostgresAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      role: req.user!.role,
      activity: is_active ? 'ACTIVATE_STAFF_USER' : 'DEACTIVATE_STAFF_USER',
      module: 'Management User',
      record_id: id,
      diff_data: { username: targetUser.username, is_active },
      ip_address: getClientIp(req),
      user_agent: (req.headers['user-agent'] as string) || undefined,
    });

    return res.json({
      success: true,
      message: `Account status updated to ${is_active ? 'Active' : 'Inactive'}`,
      is_active,
    });
  } catch (err: any) {
    console.error('Toggle status error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update account status' });
  }
});

// DELETE /api/users/:id - Delete staff account from PostgreSQL (Superadmin only)
userRouter.delete('/:id', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  const { id } = req.params;

  try {
    const userRes = await query('SELECT id, username, role, is_active FROM staff_users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Staff user not found' });
    }

    const targetUser = userRes.rows[0];

    // Security policy: user cannot delete their own account
    if (id === req.user!.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account',
      });
    }

    // Security policy: cannot delete the last active Superadmin
    if (targetUser.role === 'Superadmin') {
      const activeSuperadmins = await query(
        "SELECT COUNT(*)::int AS count FROM staff_users WHERE role = 'Superadmin' AND is_active = TRUE"
      );
      if ((activeSuperadmins.rows[0]?.count || 0) <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete the last remaining active Superadmin',
        });
      }
    }

    // Revoke all active sessions before deletion
    await revokeAllUserSessions(id);

    // Delete staff user
    await query('DELETE FROM staff_users WHERE id = $1', [id]);

    await addPostgresAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      role: req.user!.role,
      activity: 'DELETE_STAFF_USER',
      module: 'Management User',
      record_id: id,
      diff_data: { username: targetUser.username, role: targetUser.role },
      ip_address: getClientIp(req),
      user_agent: (req.headers['user-agent'] as string) || undefined,
    });

    return res.json({
      success: true,
      message: `Staff user '${targetUser.username}' deleted successfully`,
    });
  } catch (err: any) {
    console.error('Delete user error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete staff user' });
  }
});

// POST /api/users/:id/reset-password - Superadmin resets user password in PostgreSQL
userRouter.post('/:id/reset-password', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  if (!(await ensureDbConnected(res))) return;

  const { id } = req.params;
  const { new_password } = req.body || {};

  if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'New password is required and must be at least 8 characters long',
    });
  }

  try {
    const userRes = await query('SELECT id, username FROM staff_users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Staff user not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    await query('UPDATE staff_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, id]);

    // Revoke previous sessions so user must log in with new password
    await revokeAllUserSessions(id);

    await addPostgresAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      role: req.user!.role,
      activity: 'RESET_STAFF_PASSWORD',
      module: 'Management User',
      record_id: id,
      diff_data: { username: userRes.rows[0].username },
      ip_address: getClientIp(req),
      user_agent: (req.headers['user-agent'] as string) || undefined,
    });

    return res.json({
      success: true,
      message: `Password reset successfully for ${userRes.rows[0].username}`,
    });
  } catch (err: any) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to reset staff password' });
  }
});
