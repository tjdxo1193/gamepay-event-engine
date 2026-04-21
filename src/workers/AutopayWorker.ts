import { inject, singleton } from 'tsyringe';
import { Job } from 'bullmq';
import { SubscriptionRepository } from '../models/repositories/SubscriptionRepository';
import { EventBus } from '../events/EventBus';
import { QueueManager, QueueName, RenewalJobData, DeadLetterJobData } from '../queues/QueueManager';
import { EventType, SubscriptionRenewedPayload, SubscriptionExpiredPayload } from '../common/types/events';
import { SubscriptionPlan, SubscriptionStatus } from '../common/types/payment';
import { PaymentHandler } from '../handlers/PaymentHandler';

/**
 * AutopayWorker - BullMQ-based subscription renewal
 *
 * ## What this replaces (production pattern):
 * Production used `while(true)` + `zpopmin` (Redis sorted set) to poll for
 * expired subscriptions with a manual delay/retry loop. Lost messages on crash,
 * no backoff, no dead letter queue.
 *
 * ## What this improves:
 * - BullMQ delayed jobs with exponential backoff
 * - Automatic retry (3 attempts)
 * - Dead Letter Queue for permanently failed renewals
 * - Concurrency control (5 workers)
 * - Scheduled scan every 5 minutes via repeatable job
 */
@singleton()
export class AutopayWorker {
  constructor(
    @inject(SubscriptionRepository) private subRepo: SubscriptionRepository,
    @inject(EventBus) private eventBus: EventBus,
    @inject(QueueManager) private queueManager: QueueManager,
    @inject(PaymentHandler) private paymentHandler: PaymentHandler,
  ) {}

  async start(): Promise<void> {
    // Create the renewal worker
    this.queueManager.createWorker<RenewalJobData>(
      QueueName.SUBSCRIPTION_RENEWAL,
      (job) => this.processRenewal(job),
      5,
    );

    // Schedule periodic scan for expired subscriptions
    const queue = this.queueManager.getOrCreateQueue(QueueName.SUBSCRIPTION_RENEWAL);
    await queue.add('scan-expired', {} as RenewalJobData, {
      repeat: { every: 5 * 60 * 1000 }, // Every 5 minutes
      jobId: 'scan-expired-subscriptions',
    });

    // Create dead letter queue worker
    this.queueManager.createWorker<DeadLetterJobData>(
      QueueName.DEAD_LETTER,
      (job) => this.processDeadLetter(job),
      1,
    );

    console.log('[AutopayWorker] Started - scanning every 5 minutes');
  }

  private async processRenewal(job: Job<RenewalJobData>): Promise<void> {
    // If this is the scan job, find expired subscriptions and enqueue them
    if (job.name === 'scan-expired') {
      await this.scanAndEnqueueExpired();
      return;
    }

    const { subscriptionId, userId, planId, plan } = job.data;
    console.log(`[AutopayWorker] Processing renewal for ${subscriptionId}`);

    const subscription = await this.subRepo.findBySubscriptionId(subscriptionId);
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      console.log(`[AutopayWorker] Subscription ${subscriptionId} no longer active, skipping`);
      return;
    }

    if (!subscription.autoRenew) {
      // Auto-renew disabled, expire the subscription
      await this.subRepo.updateStatus(subscriptionId, SubscriptionStatus.EXPIRED);
      await this.eventBus.publish<SubscriptionExpiredPayload>(
        EventType.SUBSCRIPTION_EXPIRED,
        subscriptionId,
        'Subscription',
        { subscriptionId, expiredAt: new Date() },
      );
      return;
    }

    try {
      // Create a renewal payment
      const amount = plan === SubscriptionPlan.ANNUAL ? 99000 : 9900;
      const orderNumber = await this.paymentHandler.createPayment({
        userId,
        productId: planId,
        amount,
        currency: 'KRW',
      });

      // Simulate payment completion (in production, this would be a callback)
      await this.paymentHandler.completePayment({
        orderNumber,
        transactionId: `TXN-RENEW-${Date.now()}`,
        paidAmount: amount,
      });

      // Extend subscription
      const newEndDate = this.calculateNewEndDate(subscription.endDate, plan as SubscriptionPlan);
      await this.subRepo.renewSubscription(subscriptionId, newEndDate);

      await this.eventBus.publish<SubscriptionRenewedPayload>(
        EventType.SUBSCRIPTION_RENEWED,
        subscriptionId,
        'Subscription',
        { subscriptionId, orderNumber, newEndDate },
      );

      console.log(`[AutopayWorker] Renewed ${subscriptionId} until ${newEndDate.toISOString()}`);
    } catch (error) {
      console.error(`[AutopayWorker] Renewal failed for ${subscriptionId}:`, error);

      // After max retries, move to DLQ
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        const dlq = this.queueManager.getOrCreateQueue(QueueName.DEAD_LETTER);
        await dlq.add('failed-renewal', {
          originalQueue: QueueName.SUBSCRIPTION_RENEWAL,
          originalJobId: job.id!,
          data: job.data,
          failedReason: (error as Error).message,
          attemptsMade: job.attemptsMade + 1,
          failedAt: new Date(),
        } as DeadLetterJobData);
      }

      throw error; // Let BullMQ handle retry
    }
  }

  private async scanAndEnqueueExpired(): Promise<void> {
    const expired = await this.subRepo.findExpiredForRenewal(50);
    console.log(`[AutopayWorker] Found ${expired.length} expired subscriptions`);

    const queue = this.queueManager.getOrCreateQueue(QueueName.SUBSCRIPTION_RENEWAL);
    for (const sub of expired) {
      await queue.add('renew', {
        subscriptionId: sub.subscriptionId,
        userId: sub.userId,
        planId: sub.planId,
        plan: sub.plan,
      } as RenewalJobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `renew-${sub.subscriptionId}-${Date.now()}`,
      });
    }
  }

  private async processDeadLetter(job: Job<DeadLetterJobData>): Promise<void> {
    console.warn(`[DLQ] Failed job from ${job.data.originalQueue}:`, {
      reason: job.data.failedReason,
      attempts: job.data.attemptsMade,
      data: job.data.data,
    });
    // In production: send alert, create incident ticket, etc.
  }

  private calculateNewEndDate(currentEndDate: Date, plan: SubscriptionPlan): Date {
    const newEnd = new Date(currentEndDate);
    if (plan === SubscriptionPlan.MONTHLY) {
      newEnd.setMonth(newEnd.getMonth() + 1);
    } else {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    }
    return newEnd;
  }
}
