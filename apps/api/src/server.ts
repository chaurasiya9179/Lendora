import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { errorHandler } from './common/middleware/error.middleware.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { customerRoutes } from './modules/customers/customers.routes.js';
import { loanRoutes } from './modules/loans/loans.routes.js';
import { paymentRoutes } from './modules/payments/payments.routes.js';
import { overdueRoutes } from './modules/overdue/overdue.routes.js';
import { collectionRoutes } from './modules/collections/collections.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { settingRoutes } from './modules/settings/settings.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';

const app = express();

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Root & API Health Check
app.get('/', (_req, res) => {
  res.json({
    status: 'UP',
    message: 'Welcome to Lendora FinTech REST API',
    timestamp: new Date().toISOString(),
    health: '/api/health',
    version: '1.0.0',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Lendora FinTech API',
    version: '1.0.0',
  });
});

// Register Domain Modules
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/overdue', overdueRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler
app.use(errorHandler);

function startServer(port: number) {
  const server = app.listen(port, () => {
    console.log(`======================================================`);
    console.log(`🚀 LENDORA FINTECH API RUNNING ON PORT ${port}`);
    console.log(`   Health Check: http://localhost:${port}/api/health`);
    console.log(`   Environment:  ${config.nodeEnv}`);
    console.log(`======================================================`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is already in use by another process.`);
      console.log(`   You can kill the process on port ${port} using:`);
      console.log(`   👉 npx kill-port ${port}`);
      console.log(`   Or in PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port}).OwningProcess -Force`);
    } else {
      console.error('Server error:', err);
    }
  });

  return server;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer(config.port);
}

export default app;

