import { PaymentStatus } from '../../common/types/payment';

export interface Payment {
  id: number;
  orderNumber: string;
  userId: string;
  productId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundAmount: number | null;
  refundReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
