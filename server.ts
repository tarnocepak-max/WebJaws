import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './server/routes/authRoutes.js';
import { userRouter } from './server/routes/userRoutes.js';
import { configRouter } from './server/routes/configRoutes.js';
import { woRouter } from './server/routes/woRoutes.js';
import { importRouter } from './server/routes/importRoutes.js';
import { contactRouter } from './server/routes/contactRoutes.js';
import { systemRouter } from './server/routes/systemRoutes.js';
import { setupRouter } from './server/routes/setupRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Body parsers with support for large Excel/Text imports
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Mount WebJaws Core Backend API Routes
app.use('/api/setup', setupRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/config', configRouter);
app.use('/api/work-orders', woRouter);
app.use('/api/import', importRouter);
app.use('/api/contact', contactRouter);
app.use('/api/system', systemRouter);

// Global Error Handler for API
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

async function startServer() {
  if (!isProd) {
    // Mount Vite dev server middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[WebJaws Platform] Server running on http://0.0.0.0:${port}`);
    console.log(`[WebJaws Platform] Architecture: Full-Stack React + TypeScript + Express + PostgreSQL`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting WebJaws server:', err);
  process.exit(1);
});
