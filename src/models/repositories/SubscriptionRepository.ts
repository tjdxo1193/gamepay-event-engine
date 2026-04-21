import { RowDataPacket } from 'mysql2/promise';
import { inject, singleton } from 'tsyringe';
import { DatabaseConnectionPool } from '../../config/database';
import { Subscription } from '../entities/Subscription';
import { SubscriptionStatus } from '../../common/types/payment';

@singleton()
export class SubscriptionRepository {
  constructor(
    @inject(DatabaseConnectionPool) private db: DatabaseConnectionPool,
  ) {}

  async create(sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const result = await this.db.execute(
      `INSERT INTO subscriptions (subscription_id, user_id, plan_id, plan, status, start_date, end_date, auto_renew)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sub.subscriptionId, sub.userId, sub.planId, sub.plan, sub.status, sub.startDate, sub.endDate, sub.autoRenew],
    );
    return result.insertId;
  }

  async findBySubscriptionId(subscriptionId: string): Promise<Subscription | null> {
    const rows = await this.db.query<(Subscription & RowDataPacket)[]>(
      `SELECT id, subscription_id AS subscriptionId, user_id AS userId, plan_id AS planId,
              plan, status, start_date AS startDate, end_date AS endDate,
              cancelled_at AS cancelledAt, cancel_reason AS cancelReason,
              auto_renew AS autoRenew, created_at AS createdAt, updated_at AS updatedAt
       FROM subscriptions WHERE subscription_id = ?`,
      [subscriptionId],
    );
    return rows[0] ?? null;
  }

  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const rows = await this.db.query<(Subscription & RowDataPacket)[]>(
      `SELECT id, subscription_id AS subscriptionId, user_id AS userId, plan_id AS planId,
              plan, status, start_date AS startDate, end_date AS endDate,
              cancelled_at AS cancelledAt, cancel_reason AS cancelReason,
              auto_renew AS autoRenew, created_at AS createdAt, updated_at AS updatedAt
       FROM subscriptions WHERE user_id = ? AND status = ? LIMIT 1`,
      [userId, SubscriptionStatus.ACTIVE],
    );
    return rows[0] ?? null;
  }

  async findExpiredForRenewal(batchSize = 50): Promise<Subscription[]> {
    return this.db.query<(Subscription & RowDataPacket)[]>(
      `SELECT id, subscription_id AS subscriptionId, user_id AS userId, plan_id AS planId,
              plan, status, start_date AS startDate, end_date AS endDate,
              cancelled_at AS cancelledAt, cancel_reason AS cancelReason,
              auto_renew AS autoRenew, created_at AS createdAt, updated_at AS updatedAt
       FROM subscriptions
       WHERE status = ? AND auto_renew = true AND end_date <= NOW()
       ORDER BY end_date ASC LIMIT ?`,
      [SubscriptionStatus.ACTIVE, batchSize],
    );
  }

  async updateStatus(subscriptionId: string, status: SubscriptionStatus, extra?: Record<string, any>): Promise<void> {
    const sets = ['status = ?'];
    const params: any[] = [status];

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        const column = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        sets.push(`${column} = ?`);
        params.push(value);
      }
    }

    params.push(subscriptionId);
    await this.db.execute(
      `UPDATE subscriptions SET ${sets.join(', ')}, updated_at = NOW() WHERE subscription_id = ?`,
      params,
    );
  }

  async renewSubscription(subscriptionId: string, newEndDate: Date): Promise<void> {
    await this.db.execute(
      `UPDATE subscriptions SET end_date = ?, status = ?, updated_at = NOW() WHERE subscription_id = ?`,
      [newEndDate, SubscriptionStatus.ACTIVE, subscriptionId],
    );
  }
}
