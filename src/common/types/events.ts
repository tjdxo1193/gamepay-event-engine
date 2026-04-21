export enum EventType {
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
}

export interface DomainEvent<T = unknown> {
  id: string;
  type: EventType;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  occurredAt: Date;
  version: number;
}

export interface PaymentCreatedPayload {
  orderNumber: string;
  userId: string;
  productId: string;
  amount: number;
  currency: string;
}

export interface PaymentCompletedPayload {
  orderNumber: string;
  transactionId: string;
  paidAmount: number;
  paidAt: Date;
}

export interface PaymentFailedPayload {
  orderNumber: string;
  reason: string;
  failedAt: Date;
}

export interface PaymentRefundedPayload {
  orderNumber: string;
  refundAmount: number;
  reason: string;
  refundedAt: Date;
}

export interface SubscriptionCreatedPayload {
  subscriptionId: string;
  userId: string;
  planId: string;
  startDate: Date;
  endDate: Date;
}

export interface SubscriptionRenewedPayload {
  subscriptionId: string;
  orderNumber: string;
  newEndDate: Date;
}

export interface SubscriptionCancelledPayload {
  subscriptionId: string;
  cancelledAt: Date;
  reason: string;
}

export interface SubscriptionExpiredPayload {
  subscriptionId: string;
  expiredAt: Date;
}
