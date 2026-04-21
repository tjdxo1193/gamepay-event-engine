import { startServer } from './app';

startServer().catch((error) => {
  console.error('[GamePay] Failed to start server:', error);
  process.exit(1);
});
