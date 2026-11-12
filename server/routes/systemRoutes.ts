import { Router, Response } from 'express';
import { checkConnection, query } from '../db/db.js';
import { runMigrations } from '../db/migrate.js';
import { webJawsStore } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../auth/auth.js';

export const systemRouter = Router();

// GET /api/system/health - System and database status
systemRouter.get('/health', async (req, res) => {
  const dbStatus = await checkConnection();
  const uptimeSeconds = process.uptime();

  let totalStaff = 0;
  let activeSessions = 0;
  let auditLogsCount = 0;

  if (dbStatus.connected) {
    try {
      const staffRes = await query('SELECT COUNT(*)::int AS count FROM staff_users');
      totalStaff = staffRes.rows[0]?.count || 0;

      const sessionsRes = await query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE expires_at > NOW()');
      activeSessions = sessionsRes.rows[0]?.count || 0;

      const auditRes = await query('SELECT COUNT(*)::int AS count FROM audit_logs');
      auditLogsCount = auditRes.rows[0]?.count || 0;
    } catch {
      // Fallback if tables not yet populated
    }
  }

  return res.json({
    success: dbStatus.connected,
    status: dbStatus.connected ? 'online' : 'degraded',
    platform: 'WebJaws Integrated Operations Platform',
    version: '1.1.0 (PostgreSQL Auth & Supabase Storage)',
    uptimeSeconds,
    database: dbStatus,
    stats: {
      totalStaff,
      activeSessions,
      totalWorkOrders: webJawsStore.workOrders.length,
      auditLogsCount,
      configVersion: webJawsStore.activeConfig.version,
    },
  });
});

// Authenticated system management endpoints
systemRouter.use(requireAuth);

// POST /api/system/migrate - Run schema migration on Supabase PostgreSQL (Superadmin or IT Support)
systemRouter.post('/migrate', requireRole(['Superadmin', 'IT Support Application']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await runMigrations();
    return res.json({
      success: result.success,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Migration error: ${err.message}`,
    });
  }
});

// GET /api/system/audit-logs - Query audit logs from PostgreSQL (Superadmin only)
systemRouter.get('/audit-logs', requireRole(['Superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { module, user_id, search, limit = '100' } = req.query;
  const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 100));

  try {
    let sql = `
      SELECT id, user_id, user_name, role, activity, module, record_id, diff_data, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];

    if (module && typeof module === 'string') {
      params.push(module);
      sql += ` AND LOWER(module) = LOWER($${params.length})`;
    }

    if (user_id && typeof user_id === 'string') {
      params.push(user_id);
      sql += ` AND user_id = $${params.length}`;
    }

    if (search && typeof search === 'string' && search.trim()) {
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
      logs: result.rows,
    });
  } catch (err: any) {
    console.error('Audit logs query error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve audit logs' });
  }
});
