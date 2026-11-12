import { Router, Response } from 'express';
import { checkConnection } from '../db/db.js';
import { runMigrations } from '../db/migrate.js';
import { webJawsStore } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../auth/auth.js';

export const systemRouter = Router();

// GET /api/system/health - System and database status
systemRouter.get('/health', async (req, res) => {
  const dbStatus = await checkConnection();
  const uptimeSeconds = process.uptime();

  return res.json({
    success: true,
    status: 'online',
    platform: 'WebJaws Integrated Operations Platform',
    version: '1.0.0 (Session 1 Baseline)',
    uptimeSeconds,
    database: dbStatus,
    stats: {
      totalStaff: webJawsStore.users.length,
      activeSessions: webJawsStore.sessions.length,
      totalWorkOrders: webJawsStore.workOrders.length,
      auditLogsCount: webJawsStore.auditLogs.length,
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

// GET /api/system/audit-logs - Query audit logs (Superadmin only)
systemRouter.get('/audit-logs', requireRole(['Superadmin']), (req: AuthenticatedRequest, res: Response) => {
  const { module, user_id, search, limit = '100' } = req.query;

  let logs = [...webJawsStore.auditLogs];

  if (module && typeof module === 'string') {
    logs = logs.filter((l) => l.module.toLowerCase() === module.toLowerCase());
  }

  if (user_id && typeof user_id === 'string') {
    logs = logs.filter((l) => l.user_id === user_id);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.activity.toLowerCase().includes(q) ||
        l.user_name.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q) ||
        (l.record_id && l.record_id.toLowerCase().includes(q))
    );
  }

  const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 100));

  return res.json({
    success: true,
    total: logs.length,
    logs: logs.slice(0, limitNum),
  });
});
