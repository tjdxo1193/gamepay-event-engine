import { inject, singleton } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionRepository } from '../models/repositories/SubscriptionRepository';
import { EventBus } from '../events/EventBus';
import { SubscriptionPlan, SubscriptionStatus, CreateSubscriptionRequest } from '../common/types/payment';
import { EventType, SubscriptionCreatedPayload, SubscriptionCancelledPayload } from '../common/types/events';
import { NotFoundError, ConflictError } from '../common/errors/AppError';

@singleton()
export class SubscriptionHandler {
  constructor(
    @inject(SubscriptionRepository) private subRepo: SubscriptionRepository,
    @inject(EventBus) private eventBus: EventBus,
  ) {}

  async createSubscription(request: CreateSubscriptionRequest): Promise<string> {
    // Check for existing active subscription
    const existing = await this.subRepo.findActiveByUserId(request.userId);
    if (existing) {
      throw new ConflictError(`User ${request.userId} already has an active subscription`);
    }

    const subscriptionId = `SUB-${uuidv4().slice(0, 12)}`;
    const startDate = new Date();
    const endDate = this.calculateEndDate(startDate, request.plan);

    await this.subRepo.create({
      subscriptionId,
      userId: request.userId,
      planId: request.planId,
      plan: request.plan,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
      cancelledAt: null,
      cancelReason: null,
      autoRenew: true,
    });

    await this.eventBus.publish<SubscriptionCreatedPayload>(
      EventType.SUBSCRIPTION_CREATED,
      subscriptionId,
      'Subscription',
      { subscriptionId, userId: request.userId, planId: request.planId, startDate, endDate },
    );

    return subscriptionId;
  }

  async cancelSubscription(subscriptionId: string, reason: string): Promise<void> {
    const sub = await this.subRepo.findBySubscriptionId(subscriptionId);
    if (!sub) throw new NotFoundError('Subscription', subscriptionId);

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new ConflictError(`Subscription ${subscriptionId} is not active`);
    }

    await this.subRepo.updateStatus(subscriptionId, SubscriptionStatus.CANCELLED, {
      cancelledAt: new Date(),
      cancelReason: reason,
      autoRenew: false,
    });

    await this.eventBus.publish<SubscriptionCancelledPayload>(
      EventType.SUBSCRIPTION_CANCELLED,
      subscriptionId,
      'Subscription',
      { subscriptionId, cancelledAt: new Date(), reason },
    );
  }

  async getSubscription(subscriptionId: string) {
    const sub = await this.subRepo.findBySubscriptionId(subscriptionId);
    if (!sub) throw new NotFoundError('Subscription', subscriptionId);
    return sub;
  }

  async getActiveSubscription(userId: string) {
    return this.subRepo.findActiveByUserId(userId);
  }

  private calculateEndDate(startDate: Date, plan: SubscriptionPlan): Date {
    const endDate = new Date(startDate);
    if (plan === SubscriptionPlan.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    return endDate;
  }
}
