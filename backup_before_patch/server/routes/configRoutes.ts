import { Router, Response } from 'express';
import crypto from 'crypto';
import { webJawsStore, AppConfig, DropdownOption } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, requireRole, getClientIp } from '../auth/auth.js';

export const configRouter = Router();

// GET /api/config - Publicly accessible for UI shell / or authenticated
configRouter.get('/', (req, res) => {
  return res.json({
    success: true,
    config: webJawsStore.activeConfig,
  });
});

// Authenticated configuration routes
configRouter.use(requireAuth);

// POST /api/config - Save new version of configuration (Superadmin only)
configRouter.post('/', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  const { newConfig, changeSummary, title } = req.body;

  if (!newConfig) {
    return res.status(400).json({ success: false, error: 'newConfig payload is required' });
  }

  const currentVersion = webJawsStore.activeConfig.version;
  const nextVersion = currentVersion + 1;

  const versionedConfig: AppConfig = {
    ...newConfig,
    version: nextVersion,
  };

  // Record version history
  const versionRecord = {
    version_id: crypto.randomUUID(),
    version_number: nextVersion,
    title: title || `Configuration Update v${nextVersion}`,
    config_data: versionedConfig,
    change_summary: changeSummary || 'Centralized configuration modified by Superadmin',
    created_by_name: req.user!.full_name,
    created_at: new Date().toISOString(),
  };

  webJawsStore.configVersions.unshift(versionRecord);
  webJawsStore.activeConfig = versionedConfig;

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'UPDATE_APP_CONFIG',
    module: 'Centralized Configuration',
    record_id: versionRecord.version_id,
    diff_data: { version: nextVersion, summary: changeSummary },
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `Application configuration updated to version ${nextVersion}`,
    config: versionedConfig,
    versionRecord,
  });
});

// GET /api/config/versions - Get configuration version history (Superadmin only)
configRouter.get('/versions', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    versions: webJawsStore.configVersions,
  });
});

// POST /api/config/rollback/:versionNumber - Rollback to prior configuration (Superadmin only)
configRouter.post('/rollback/:versionNumber', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  const targetVer = parseInt(req.params.versionNumber, 10);
  if (isNaN(targetVer)) {
    return res.status(400).json({ success: false, error: 'Invalid version number' });
  }

  const targetRecord = webJawsStore.configVersions.find((v) => v.version_number === targetVer);
  if (!targetRecord) {
    return res.status(404).json({ success: false, error: `Config version ${targetVer} not found` });
  }

  const nextVer = webJawsStore.activeConfig.version + 1;
  const restoredConfig: AppConfig = {
    ...targetRecord.config_data,
    version: nextVer,
  };

  const rollbackRecord = {
    version_id: crypto.randomUUID(),
    version_number: nextVer,
    title: `Rollback to Version ${targetVer}`,
    config_data: restoredConfig,
    change_summary: `Rollback executed by ${req.user!.full_name} targeting baseline from v${targetVer}`,
    created_by_name: req.user!.full_name,
    created_at: new Date().toISOString(),
  };

  webJawsStore.configVersions.unshift(rollbackRecord);
  webJawsStore.activeConfig = restoredConfig;

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'ROLLBACK_APP_CONFIG',
    module: 'Centralized Configuration',
    record_id: rollbackRecord.version_id,
    diff_data: { rolledBackTo: targetVer, newVersion: nextVer },
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: `Configuration successfully rolled back to state of v${targetVer} (now active as v${nextVer})`,
    config: restoredConfig,
  });
});

// GET /api/config/droplists - Retrieve droplist items
configRouter.get('/droplists', (req, res) => {
  const { category } = req.query;
  let items = webJawsStore.dropdowns.filter((d) => d.is_active);

  if (category && typeof category === 'string') {
    items = items.filter((d) => d.category === category);
  }

  items.sort((a, b) => a.order_index - b.order_index);

  return res.json({
    success: true,
    droplists: items,
  });
});

// POST /api/config/droplists - Add new droplist option (Superadmin only)
configRouter.post('/droplists', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  const { category, label, value, order_index } = req.body;

  if (!category || !label || !value) {
    return res.status(400).json({ success: false, error: 'Category, label, and value are required' });
  }

  const existingInCat = webJawsStore.dropdowns.filter((d) => d.category === category);
  const nextOrder = order_index !== undefined ? order_index : existingInCat.length + 1;

  const newItem: DropdownOption = {
    id: crypto.randomUUID(),
    category,
    label: label.trim(),
    value: value.trim(),
    order_index: nextOrder,
    is_active: true,
  };

  webJawsStore.dropdowns.push(newItem);

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'ADD_DROPLIST_OPTION',
    module: 'Setting Droplist',
    record_id: newItem.id,
    diff_data: { category, label, value },
    ip_address: getClientIp(req),
  });

  return res.status(201).json({
    success: true,
    message: `Dropdown option '${newItem.label}' added`,
    item: newItem,
  });
});

// DELETE /api/config/droplists/:id - Delete or disable droplist item (Superadmin only)
configRouter.delete('/droplists/:id', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const index = webJawsStore.dropdowns.findIndex((d) => d.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Dropdown item not found' });
  }

  const removed = webJawsStore.dropdowns.splice(index, 1)[0];

  webJawsStore.addAuditLog({
    user_id: req.user!.id,
    user_name: req.user!.full_name,
    role: req.user!.role,
    activity: 'DELETE_DROPLIST_OPTION',
    module: 'Setting Droplist',
    record_id: id,
    diff_data: { removedItem: removed },
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: 'Dropdown item deleted successfully',
  });
});
