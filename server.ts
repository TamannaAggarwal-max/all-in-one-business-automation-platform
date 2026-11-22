import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './src/server/routes/auth.ts';
import leadsRoutes from './src/server/routes/leads.ts';
import customersRoutes from './src/server/routes/customers.ts';
import productsRoutes from './src/server/routes/products.ts';
import followUpsRoutes from './src/server/routes/followUps.ts';
import automationsRoutes from './src/server/routes/automations.ts';
import { brandRouter, publicStoreRouter } from './src/server/routes/brandAndStore.ts';
import { aiRouter, analyticsRouter } from './src/server/routes/analyticsAndAi.ts';
import {
  notificationsRouter,
  searchRouter,
  teamRouter,
} from './src/server/routes/teamAndSystem.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.APP_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter((o): o is string => Boolean(o && o.trim()));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bizpilot-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/follow-ups', followUpsRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/brand', brandRouter);
app.use('/api/store', publicStoreRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/team', teamRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/search', searchRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err);
  const status =
    typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;
  let message = 'An unexpected server error occurred. Please try again.';
  if (err instanceof Error && status < 500) {
    message = err.message;
  } else if (status === 503) {
    message = 'AI service is temporarily busy. Please try again in a moment.';
  } else if (status === 504) {
    message = 'AI request timed out. Please try again.';
  }
  res.status(status).json({ error: message });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BizPilot server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
