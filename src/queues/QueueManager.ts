import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { inject, singleton } from 'tsyringe';
import { RedisClient } from '../config/redis';

export enum QueueName {
  PAYMENT_PROCESSING = 'payment-processing',
  SUBSCRIPTION_RENEWAL = 'subscription-renewal',
  DEAD_LETTER = 'dead-letter',
}

export interface PaymentJobData {
  orderNumber: string;
  userId: string;
  productId: string;
  amount: number;
  currency: string;
}

export interface RenewalJobData {
  subscriptionId: string;
  userId: string;
  planId: string;
  plan: string;
}

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  failedAt: Date;
}

@singleton()
export class QueueManager {
  private queues = new Map<QueueName, Queue>();
  private workers = new Map<QueueName, Worker>();

  constructor(
    @inject(RedisClient) private redis: RedisClient,
  ) {}

  getOrCreateQueue(name: QueueName): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.redis.getClient().duplicate(),
        defaultJobOptions: {
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  createWorker<T>(
    name: QueueName,
    processor: (job: Job<T>) => Promise<void>,
    concurrency = 5,
  ): Worker<T> {
    const worker = new Worker<T>(name, processor, {
      connection: this.redis.getClient().duplicate(),
      concurrency,
    });

    worker.on('completed', (job) => {
      console.log(`[${name}] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[${name}] Job ${job?.id} failed:`, err.message);
    });

    this.workers.set(name, worker as Worker);
    return worker;
  }

  getQueue(name: QueueName): Queue | undefined {
    return this.queues.get(name);
  }

  async closeAll(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}
