import 'reflect-metadata';
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import { container } from 'tsyringe';
import { setupContainer } from './config/container';
import { createRouter } from './routes';
import { AppError } from './common/errors/AppError';
import { AutopayWorker } from './workers/AutopayWorker';
import { PaymentSummaryProjector } from './workers/PaymentSummaryProjector';
import { env } from './config/env';

// Setup DI
setupContainer();

const app = express();

// Middleware
app.use(compression());
app.use(morgan('short'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for dashboard
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  next();
});

// Routes
app.use(createRouter());

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
});

export async function startServer(): Promise<void> {
  // Register CQRS projector
  const projector = container.resolve(PaymentSummaryProjector);
  projector.register();

  // Start autopay worker
  const autopayWorker = container.resolve(AutopayWorker);
  await autopayWorker.start();

  app.listen(env.port, () => {
    console.log(`[GamePay] Server running on port ${env.port}`);
    console.log(`[GamePay] Environment: ${env.nodeEnv}`);
  });
}

export default app;
