import 'reflect-metadata';
import { container } from 'tsyringe';
import { setupTestInfra, setupDIContainer, teardownTestInfra, cleanTables } from './setup';
import { SubscriptionHandler } from '../../src/handlers/SubscriptionHandler';
import { SubscriptionRepository } from '../../src/models/repositories/SubscriptionRepository';
import { EventStoreRepository } from '../../src/models/repositories/EventStoreRepository';
import { SubscriptionPlan, SubscriptionStatus } from '../../src/common/types/payment';
import { EventType } from '../../src/common/types/events';

let subHandler: SubscriptionHandler;
let subRepo: SubscriptionRepository;
let eventStore: EventStoreRepository;

beforeAll(async () => {
  const config = await setupTestInfra();
  setupDIContainer(config);

  subHandler = container.resolve(SubscriptionHandler);
  subRepo = container.resolve(SubscriptionRepository);
  eventStore = container.resolve(EventStoreRepository);
}, 120000);

afterAll(async () => {
  await teardownTestInfra();
}, 30000);

beforeEach(async () => {
  await cleanTables();
});

describe('Subscription Flow - Integration', () => {
  it('should create a monthly subscription', async () => {
    const subscriptionId = await subHandler.createSubscription({
      userId: 'user-101',
      planId: 'plan-monthly',
      plan: SubscriptionPlan.MONTHLY,
    });

    expect(subscriptionId).toMatch(/^SUB-/);

    const sub = await subHandler.getSubscription(subscriptionId);
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(sub.plan).toBe(SubscriptionPlan.MONTHLY);
    expect(sub.autoRenew).toBeTruthy();

    // Verify end date is ~1 month from now
    const diffMs = new Date(sub.endDate).getTime() - new Date(sub.startDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(31);

    // Verify event stored
    const events = await eventStore.findByAggregateId(subscriptionId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(EventType.SUBSCRIPTION_CREATED);
  });

  it('should create an annual subscription', async () => {
    const subscriptionId = await subHandler.createSubscription({
      userId: 'user-102',
      planId: 'plan-annual',
      plan: SubscriptionPlan.ANNUAL,
    });

    const sub = await subHandler.getSubscription(subscriptionId);
    const diffMs = new Date(sub.endDate).getTime() - new Date(sub.startDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(365);
  });

  it('should prevent duplicate active subscriptions for same user', async () => {
    await subHandler.createSubscription({
      userId: 'user-103',
      planId: 'plan-monthly',
      plan: SubscriptionPlan.MONTHLY,
    });

    await expect(
      subHandler.createSubscription({
        userId: 'user-103',
        planId: 'plan-annual',
        plan: SubscriptionPlan.ANNUAL,
      }),
    ).rejects.toThrow('already has an active subscription');
  });

  it('should cancel a subscription', async () => {
    const subscriptionId = await subHandler.createSubscription({
      userId: 'user-104',
      planId: 'plan-monthly',
      plan: SubscriptionPlan.MONTHLY,
    });

    await subHandler.cancelSubscription(subscriptionId, 'Too expensive');

    const sub = await subHandler.getSubscription(subscriptionId);
    expect(sub.status).toBe(SubscriptionStatus.CANCELLED);
    expect(sub.cancelReason).toBe('Too expensive');

    // Verify events (2: CREATED + CANCELLED)
    const events = await eventStore.findByAggregateId(subscriptionId);
    expect(events).toHaveLength(2);
    expect(events[1].eventType).toBe(EventType.SUBSCRIPTION_CANCELLED);
  });

  it('should allow new subscription after cancellation', async () => {
    const firstId = await subHandler.createSubscription({
      userId: 'user-105',
      planId: 'plan-monthly',
      plan: SubscriptionPlan.MONTHLY,
    });

    await subHandler.cancelSubscription(firstId, 'Switching plans');

    // Should be able to create new subscription
    const secondId = await subHandler.createSubscription({
      userId: 'user-105',
      planId: 'plan-annual',
      plan: SubscriptionPlan.ANNUAL,
    });

    expect(secondId).not.toBe(firstId);
    const activeSub = await subHandler.getActiveSubscription('user-105');
    expect(activeSub).not.toBeNull();
    expect(activeSub!.subscriptionId).toBe(secondId);
  });

  it('should find expired subscriptions for renewal', async () => {
    // Directly insert an expired subscription
    await subRepo.create({
      subscriptionId: 'SUB-EXPIRED-001',
      userId: 'user-106',
      planId: 'plan-monthly',
      plan: SubscriptionPlan.MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'), // already expired
      cancelledAt: null,
      cancelReason: null,
      autoRenew: true,
    });

    const expired = await subRepo.findExpiredForRenewal();
    expect(expired.length).toBeGreaterThanOrEqual(1);
    expect(expired.some((s) => s.subscriptionId === 'SUB-EXPIRED-001')).toBe(true);
  });
});
