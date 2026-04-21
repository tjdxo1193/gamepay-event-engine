import { SubscriptionPlan, SubscriptionStatus } from '../../common/types/payment';

export interface Subscription {
  id: number;
  subscriptionId: string;
  userId: string;
  planId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}
