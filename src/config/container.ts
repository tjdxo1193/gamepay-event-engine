import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseConnectionPool } from './database';
import { RedisClient } from './redis';
import { EventBus } from '../events/EventBus';
import { QueueManager } from '../queues/QueueManager';
import { PaymentRepository } from '../models/repositories/PaymentRepository';
import { SubscriptionRepository } from '../models/repositories/SubscriptionRepository';
import { EventStoreRepository } from '../models/repositories/EventStoreRepository';
import { PaymentHandler } from '../handlers/PaymentHandler';
import { SubscriptionHandler } from '../handlers/SubscriptionHandler';
import { AutopayWorker } from '../workers/AutopayWorker';
import { PaymentSummaryProjector } from '../workers/PaymentSummaryProjector';
import { PaymentController } from '../controllers/PaymentController';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { EventController } from '../controllers/EventController';

export function setupContainer(): void {
  // Infrastructure
  container.registerSingleton(DatabaseConnectionPool);
  container.registerSingleton(RedisClient);

  // Event system
  container.registerSingleton(EventBus);
  container.registerSingleton(QueueManager);

  // Repositories
  container.registerSingleton(PaymentRepository);
  container.registerSingleton(SubscriptionRepository);
  container.registerSingleton(EventStoreRepository);

  // Handlers
  container.registerSingleton(PaymentHandler);
  container.registerSingleton(SubscriptionHandler);

  // Workers
  container.registerSingleton(AutopayWorker);
  container.registerSingleton(PaymentSummaryProjector);

  // Controllers
  container.registerSingleton(PaymentController);
  container.registerSingleton(SubscriptionController);
  container.registerSingleton(EventController);
}
