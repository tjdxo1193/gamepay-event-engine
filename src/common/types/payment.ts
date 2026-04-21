export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
}

export enum SubscriptionPlan {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

export interface CreatePaymentRequest {
  userId: string;
  productId: string;
  amount: number;
  currency?: string;
}

export interface CompletePaymentRequest {
  orderNumber: string;
  transactionId: string;
  paidAmount: number;
}

export interface RefundPaymentRequest {
  orderNumber: string;
  refundAmount: number;
  reason: string;
}

export interface CreateSubscriptionRequest {
  userId: string;
  planId: string;
  plan: SubscriptionPlan;
}
