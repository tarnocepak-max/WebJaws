import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/db.js';
import { StaffUser } from '../db/store.js';
import {
  AuthenticatedRequest,
  requireAuth,
  requireRole,
  getClientIp,
  revokeAllUserSessions,
  addPostgresAuditLog,
} from '../auth/auth.js';

export const userRouter = Router();

// All user management routes require authentication and Superadmin or IT Support Application role
userRouter.use(requireAuth);

// GET /api/users - List all staff users from PostgreSQL
userRouter.get('/', requireRole(['Superadmin', 'IT Support Application']), async (req: AuthenticatedRequest, res: Response) => {
  const { role, is_active, search } = req.query;

  try {
    let sql = `
      SELECT id, username, email, full_name, role, contractor_name, area, phone, avatar_url,
             is_active, last_login_at, created_at, updated_at
      FROM staff_users
      WHERE 1=1
    `;
    const params: any[] = [];

    if (role && typeof role === 'string') {
      params.push(role);
      sql += ` AND role = $${params.length}`;
    }

    if (is_active !== undefined) {
      const activeBool = is_active === 'true';
      params.push(activeBool);
      sql += ` AND is_active = $${params.length}`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (
        LOWER(username) LIKE $${params.length} OR
        LOWER(full_name) LIKE $${params.length} OR
        LOWER(email) LIKE $${params.length} OR
        LOWER(COALESCE(contractor_name, '')) LIKE $${params.length} OR
        LOWER(COALESCE(area, '')) LIKE $${params.length}
      )`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    const users: StaffUser[] = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      password_hash: '',
      full_name: row.full_name,
      role: row.role,
      contractor_name: row.contractor_name || undefined,
      area: row.area || undefined,
      phone: row.phone || undefined,
      avatar_url: row.avatar_url || undefined,
      is_active: row.is_active,
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

// POST /api/users - Create new staff account in PostgreSQL (Superadmin only)
userRouter.post('/', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { username, email, password, full_name, role, contractor_name, area, phone } = req.body || {};

  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({
      success: false,
      error: 'Fields username, email, password, full_name, and role are required',
    });
  }

  const validRoles = [
    'Superadmin',
    'Agent Dispatch',
    'Leader',
    'Installer',
    'Monitoring Data',
    'IT Support Application',
  ];

  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: `Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`,
    });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();

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
      RETURNING id, username, email, full_name, role, contractor_name, area, phone, is_active, created_at, updated_at`,
      [
        cleanUsername,
        cleanEmail,
        passwordHash,
        String(full_name).trim(),
        role,
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
      diff_data: { username: newUser.username, role: newUser.role, contractor: newUser.contractor_name, area: newUser.area },
      ip_address: getClientIp(req),
      user_agent: (req.headers['user-agent'] as string) || undefined,
    });

    return res.status(201).json({
      success: true,
      message: `Staff user '${newUser.username}' created successfully`,
      user: newUser,
    });
  } catch (err: any) {
    console.error('Create user error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create staff user' });
  }
});

// PUT /api/users/:id - Update staff account details in PostgreSQL
userRouter.put('/:id', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { full_name, role, contractor_name, area, phone } = req.body || {};

  try {
    const userRes = await query('SELECT * FROM staff_users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Staff user not found' });
    }

    const user = userRes.rows[0];

    // Prevent demoting the last active Superadmin
    if (user.role === 'Superadmin' && role && role !== 'Superadmin') {
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

    const updatedFullName = full_name ? String(full_name).trim() : user.full_name;
    const updatedRole = role || user.role;
    const updatedContractor = contractor_name !== undefined ? (contractor_name ? String(contractor_name).trim() : null) : user.contractor_name;
    const updatedArea = area !== undefined ? (area ? String(area).trim() : null) : user.area;
    const updatedPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : user.phone;

    const updateRes = await query(
      `UPDATE staff_users
       SET full_name = $1, role = $2, contractor_name = $3, area = $4, phone = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, email, full_name, role, contractor_name, area, phone, avatar_url, is_active, last_login_at, created_at, updated_at`,
      [updatedFullName, updatedRole, updatedContractor, updatedArea, updatedPhone, id]
    );

    const safeUser = updateRes.rows[0];

    await addPostgresAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      role: req.user!.role,
      activity: 'UPDATE_STAFF_USER',
      module: 'Management User',
      record_id: user.id,
      diff_data: { full_name: safeUser.full_name, role: safeUser.role, contractor_name: safeUser.contractor_name, area: safeUser.area },
      ip_address: getClientIp(req),
      user_agent: (req.headers['user-agent'] as string) || undefined,
    });

    return res.json({
      success: true,
      message: 'Staff user updated successfully',
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Update user error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update staff user' });
  }
});

// PATCH /api/users/:id/status - Toggle active/inactive in PostgreSQL
userRouter.patch('/:id/status', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body || {};

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'is_active must be a boolean' });
  }

  try {
    const userRes = await query('SELECT id, username, role FROM staff_users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Staff user not found' });
    }

    if (id === req.user!.id && !is_active) {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
    }

    await query('UPDATE staff_users SET is_active = $1, updated_at = NOW() WHERE id = $2', [is_active, id]);

    // If user deactivated, revoke all their active sessions immediately from PostgreSQL
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

// POST /api/users/:id/reset-password - Superadmin resets user password in PostgreSQL
userRouter.post('/:id/reset-password', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
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
