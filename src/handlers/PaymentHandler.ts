import { inject, singleton } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { PaymentRepository } from '../models/repositories/PaymentRepository';
import { EventBus } from '../events/EventBus';
import { QueueManager, QueueName, PaymentJobData } from '../queues/QueueManager';
import { PaymentStatus, CreatePaymentRequest, CompletePaymentRequest, RefundPaymentRequest } from '../common/types/payment';
import { EventType, PaymentCompletedPayload, PaymentFailedPayload, PaymentRefundedPayload } from '../common/types/events';
import { DuplicatePaymentError, NotFoundError } from '../common/errors/AppError';
import { RedisClient } from '../config/redis';

const IDEMPOTENCY_TTL = 3600; // 1 hour

@singleton()
export class PaymentHandler {
  constructor(
    @inject(PaymentRepository) private paymentRepo: PaymentRepository,
    @inject(EventBus) private eventBus: EventBus,
    @inject(QueueManager) private queueManager: QueueManager,
    @inject(RedisClient) private redis: RedisClient,
  ) {}

  async createPayment(request: CreatePaymentRequest): Promise<string> {
    const orderNumber = `ORD-${Date.now()}-${uuidv4().slice(0, 8)}`;

    // Idempotency check via Redis
    const idempotencyKey = `payment:idempotency:${request.userId}:${request.productId}`;
    const existing = await this.redis.get(idempotencyKey);
    if (existing) {
      throw new DuplicatePaymentError(existing);
    }

    // Create payment record
    await this.paymentRepo.create({
      orderNumber,
      userId: request.userId,
      productId: request.productId,
      amount: request.amount,
      currency: request.currency || 'KRW',
      status: PaymentStatus.PENDING,
      transactionId: null,
      paidAt: null,
      refundedAt: null,
      refundAmount: null,
      refundReason: null,
    });

    // Set idempotency key
    await this.redis.set(idempotencyKey, orderNumber, IDEMPOTENCY_TTL);

    // Publish event
    await this.eventBus.publish(
      EventType.PAYMENT_CREATED,
      orderNumber,
      'Payment',
      { orderNumber, userId: request.userId, productId: request.productId, amount: request.amount, currency: request.currency || 'KRW' },
    );

    // Enqueue for async processing
    const queue = this.queueManager.getOrCreateQueue(QueueName.PAYMENT_PROCESSING);
    await queue.add('process-payment', {
      orderNumber,
      userId: request.userId,
      productId: request.productId,
      amount: request.amount,
      currency: request.currency || 'KRW',
    } as PaymentJobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return orderNumber;
  }

  async completePayment(request: CompletePaymentRequest): Promise<void> {
    const payment = await this.paymentRepo.findByOrderNumber(request.orderNumber);
    if (!payment) throw new NotFoundError('Payment', request.orderNumber);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new DuplicatePaymentError(request.orderNumber);
    }

    await this.paymentRepo.updateStatus(request.orderNumber, PaymentStatus.COMPLETED, {
      transactionId: request.transactionId,
      paidAt: new Date(),
    });

    await this.eventBus.publish<PaymentCompletedPayload>(
      EventType.PAYMENT_COMPLETED,
      request.orderNumber,
      'Payment',
      {
        orderNumber: request.orderNumber,
        transactionId: request.transactionId,
        paidAmount: request.paidAmount,
        paidAt: new Date(),
      },
    );
  }

  async failPayment(orderNumber: string, reason: string): Promise<void> {
    const payment = await this.paymentRepo.findByOrderNumber(orderNumber);
    if (!payment) throw new NotFoundError('Payment', orderNumber);

    await this.paymentRepo.updateStatus(orderNumber, PaymentStatus.FAILED);

    await this.eventBus.publish<PaymentFailedPayload>(
      EventType.PAYMENT_FAILED,
      orderNumber,
      'Payment',
      { orderNumber, reason, failedAt: new Date() },
    );
  }

  async refundPayment(request: RefundPaymentRequest): Promise<void> {
    const payment = await this.paymentRepo.findByOrderNumber(request.orderNumber);
    if (!payment) throw new NotFoundError('Payment', request.orderNumber);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error(`Cannot refund payment in ${payment.status} status`);
    }

    await this.paymentRepo.updateStatus(request.orderNumber, PaymentStatus.REFUNDED, {
      refundAmount: request.refundAmount,
      refundReason: request.reason,
      refundedAt: new Date(),
    });

    await this.eventBus.publish<PaymentRefundedPayload>(
      EventType.PAYMENT_REFUNDED,
      request.orderNumber,
      'Payment',
      {
        orderNumber: request.orderNumber,
        refundAmount: request.refundAmount,
        reason: request.reason,
        refundedAt: new Date(),
      },
    );
  }

  async getPayment(orderNumber: string) {
    const payment = await this.paymentRepo.findByOrderNumber(orderNumber);
    if (!payment) throw new NotFoundError('Payment', orderNumber);
    return payment;
  }

  async getUserPayments(userId: string, limit?: number, offset?: number) {
    return this.paymentRepo.findByUserId(userId, limit, offset);
  }
}
