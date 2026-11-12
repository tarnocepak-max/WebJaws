import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { webJawsStore, StaffUser } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, requireRole, getClientIp } from '../auth/auth.js';

export const userRouter = Router();

// All user management routes require authentication and Superadmin or IT Support Application role
userRouter.use(requireAuth);

// GET /api/users - List all staff users
userRouter.get('/', requireRole(['Superadmin', 'IT Support Application']), (req: AuthenticatedRequest, res: Response) => {
  const { role, is_active, search } = req.query;

  let users = webJawsStore.users.map(({ password_hash, ...safeUser }) => safeUser);

  if (role && typeof role === 'string') {
    users = users.filter((u) => u.role === role);
  }

  if (is_active !== undefined) {
    const activeBool = is_active === 'true';
    users = users.filter((u) => u.is_active === activeBool);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.contractor_name && u.contractor_name.toLowerCase().includes(q)) ||
        (u.area && u.area.toLowerCase().includes(q))
    );
  }

  return res.json({
    success: true,
    total: users.length,
    users,
  });
});

// POST /api/users - Create new staff account (Superadmin only)
userRouter.post('/', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { username, email, password, full_name, role, contractor_name, area, phone } = req.body;

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

  // Check unique username and email
  const existingUser = webJawsStore.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() || u.email.toLowerCase() === email.trim().toLowerCase()
  );

  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'A user with this username or email already exists',
    });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser: StaffUser = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    username: username.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    password_hash: passwordHash,
    full_name: full_name.trim(),
    role,
    contractor_name: contractor_name || undefined,
    area: area || undefined,
    phone: phone || undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  webJawsStore.users.push(newUser);

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'CREATE_STAFF_USER',
    module: 'Management User',
    record_id: newUser.id,
    diff_data: { username: newUser.username, role: newUser.role, contractor: newUser.contractor_name, area: newUser.area },
    ip_address: getClientIp(req),
  });

  const { password_hash, ...safeUser } = newUser;

  return res.status(201).json({
    success: true,
    message: `Staff user '${newUser.username}' created successfully`,
    user: safeUser,
  });
});

// PUT /api/users/:id - Update staff account details
userRouter.put('/:id', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { full_name, role, contractor_name, area, phone } = req.body;

  const user = webJawsStore.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Staff user not found' });
  }

  // Prevent demoting the last active Superadmin
  if (user.role === 'Superadmin' && role && role !== 'Superadmin') {
    const activeSuperadmins = webJawsStore.users.filter((u) => u.role === 'Superadmin' && u.is_active);
    if (activeSuperadmins.length <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot demote the last remaining active Superadmin',
      });
    }
  }

  if (full_name) user.full_name = full_name.trim();
  if (role) user.role = role;
  if (contractor_name !== undefined) user.contractor_name = contractor_name;
  if (area !== undefined) user.area = area;
  if (phone !== undefined) user.phone = phone;
  user.updated_at = new Date().toISOString();

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'UPDATE_STAFF_USER',
    module: 'Management User',
    record_id: user.id,
    diff_data: { full_name: user.full_name, role: user.role, contractor_name: user.contractor_name, area: user.area },
    ip_address: getClientIp(req),
  });

  const { password_hash, ...safeUser } = user;
  return res.json({
    success: true,
    message: 'Staff user updated successfully',
    user: safeUser,
  });
});

// PATCH /api/users/:id/status - Toggle active/inactive
userRouter.patch('/:id/status', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'is_active must be a boolean' });
  }

  const user = webJawsStore.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Staff user not found' });
  }

  if (user.id === req.user!.id && !is_active) {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
  }

  user.is_active = is_active;
  user.updated_at = new Date().toISOString();

  // If user deactivated, revoke all their active sessions immediately
  if (!is_active) {
    webJawsStore.revokeUserSessions(user.id);
  }

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: is_active ? 'ACTIVATE_STAFF_USER' : 'DEACTIVATE_STAFF_USER',
    module: 'Management User',
    record_id: user.id,
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `Account status updated to ${is_active ? 'Active' : 'Inactive'}`,
    is_active: user.is_active,
  });
});

// POST /api/users/:id/reset-password - Superadmin resets user password
userRouter.post('/:id/reset-password', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'New password is required and must be at least 8 characters long',
    });
  }

  const user = webJawsStore.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Staff user not found' });
  }

  const salt = await bcrypt.genSalt(10);
  user.password_hash = await bcrypt.hash(new_password, salt);
  user.updated_at = new Date().toISOString();

  // Revoke previous sessions so user must log in with new password
  webJawsStore.revokeUserSessions(user.id);

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'RESET_STAFF_PASSWORD',
    module: 'Management User',
    record_id: user.id,
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `Password reset successfully for ${user.username}`,
  });
});
