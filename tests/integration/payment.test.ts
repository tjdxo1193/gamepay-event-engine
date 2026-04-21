import 'reflect-metadata';
import { container } from 'tsyringe';
import { setupTestInfra, setupDIContainer, teardownTestInfra, cleanTables } from './setup';
import { PaymentHandler } from '../../src/handlers/PaymentHandler';
import { PaymentRepository } from '../../src/models/repositories/PaymentRepository';
import { EventStoreRepository } from '../../src/models/repositories/EventStoreRepository';
import { PaymentSummaryProjector } from '../../src/workers/PaymentSummaryProjector';
import { PaymentStatus } from '../../src/common/types/payment';
import { EventType } from '../../src/common/types/events';

let paymentHandler: PaymentHandler;
let paymentRepo: PaymentRepository;
let eventStore: EventStoreRepository;
let projector: PaymentSummaryProjector;

beforeAll(async () => {
  const config = await setupTestInfra();
  setupDIContainer(config);

  paymentHandler = container.resolve(PaymentHandler);
  paymentRepo = container.resolve(PaymentRepository);
  eventStore = container.resolve(EventStoreRepository);
  projector = container.resolve(PaymentSummaryProjector);

  // Register CQRS projector
  projector.register();
}, 120000);

afterAll(async () => {
  await teardownTestInfra();
}, 30000);

beforeEach(async () => {
  await cleanTables();
});

describe('Payment Flow - Integration', () => {
  it('should create a payment and store event', async () => {
    const orderNumber = await paymentHandler.createPayment({
      userId: 'user-001',
      productId: 'prod-monthly',
      amount: 9900,
      currency: 'KRW',
    });

    expect(orderNumber).toMatch(/^ORD-/);

    // Verify payment record
    const payment = await paymentHandler.getPayment(orderNumber);
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.amount).toBe(9900);
    expect(payment.userId).toBe('user-001');

    // Verify event was stored
    const events = await eventStore.findByAggregateId(orderNumber);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(EventType.PAYMENT_CREATED);
  });

  it('should complete a payment and update CQRS summary', async () => {
    const orderNumber = await paymentHandler.createPayment({
      userId: 'user-002',
      productId: 'prod-annual',
      amount: 99000,
    });

    await paymentHandler.completePayment({
      orderNumber,
      transactionId: 'TXN-TEST-001',
      paidAmount: 99000,
    });

    // Verify payment status
    const payment = await paymentHandler.getPayment(orderNumber);
    expect(payment.status).toBe(PaymentStatus.COMPLETED);
    expect(payment.transactionId).toBe('TXN-TEST-001');

    // Verify events (2: CREATED + COMPLETED)
    const events = await eventStore.findByAggregateId(orderNumber);
    expect(events).toHaveLength(2);
    expect(events[1].eventType).toBe(EventType.PAYMENT_COMPLETED);

    // Verify CQRS read model was updated
    const stats = await projector.getTotalStats();
    expect(Number(stats!.totalRevenue)).toBe(99000);
    expect(Number(stats!.successfulTransactions)).toBe(1);
  });

  it('should refund a completed payment', async () => {
    const orderNumber = await paymentHandler.createPayment({
      userId: 'user-003',
      productId: 'prod-monthly',
      amount: 9900,
    });

    await paymentHandler.completePayment({
      orderNumber,
      transactionId: 'TXN-TEST-002',
      paidAmount: 9900,
    });

    await paymentHandler.refundPayment({
      orderNumber,
      refundAmount: 9900,
      reason: 'Customer request',
    });

    const payment = await paymentHandler.getPayment(orderNumber);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
    expect(payment.refundAmount).toBe(9900);

    // Verify events (3: CREATED + COMPLETED + REFUNDED)
    const events = await eventStore.findByAggregateId(orderNumber);
    expect(events).toHaveLength(3);
    expect(events[2].eventType).toBe(EventType.PAYMENT_REFUNDED);
  });

  it('should prevent duplicate payment via idempotency', async () => {
    await paymentHandler.createPayment({
      userId: 'user-004',
      productId: 'prod-monthly',
      amount: 9900,
    });

    // Same user + product should fail (idempotency check)
    await expect(
      paymentHandler.createPayment({
        userId: 'user-004',
        productId: 'prod-monthly',
        amount: 9900,
      }),
    ).rejects.toThrow('Duplicate payment');
  });

  it('should reject completing an already completed payment', async () => {
    const orderNumber = await paymentHandler.createPayment({
      userId: 'user-005',
      productId: 'prod-annual',
      amount: 99000,
    });

    await paymentHandler.completePayment({
      orderNumber,
      transactionId: 'TXN-TEST-003',
      paidAmount: 99000,
    });

    await expect(
      paymentHandler.completePayment({
        orderNumber,
        transactionId: 'TXN-TEST-004',
        paidAmount: 99000,
      }),
    ).rejects.toThrow('Duplicate payment');
  });

  it('should list user payments', async () => {
    // Create 3 payments for same user
    for (let i = 0; i < 3; i++) {
      const orderNumber = await paymentHandler.createPayment({
        userId: 'user-006',
        productId: `prod-${i}`,
        amount: 1000 * (i + 1),
      });
      // Complete each immediately to avoid idempotency conflict
    }

    const payments = await paymentHandler.getUserPayments('user-006');
    expect(payments).toHaveLength(3);
  });
});
