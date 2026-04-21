import { inject, singleton } from 'tsyringe';
import { DatabaseConnectionPool } from '../config/database';
import { EventBus } from '../events/EventBus';
import { DomainEvent, EventType, PaymentCompletedPayload, PaymentRefundedPayload } from '../common/types/events';
import { RowDataPacket } from 'mysql2/promise';

/**
 * PaymentSummaryProjector - CQRS Read Model
 *
 * Listens to payment events and maintains a denormalized `payment_summary` table
 * optimized for dashboard queries. This replaces the production pattern of
 * querying the write model directly with node-ts-cache for statistics.
 *
 * Write side: normalized payments + event_store tables
 * Read side:  payment_summary (materialized from events)
 */
@singleton()
export class PaymentSummaryProjector {
  constructor(
    @inject(DatabaseConnectionPool) private db: DatabaseConnectionPool,
    @inject(EventBus) private eventBus: EventBus,
  ) {}

  register(): void {
    this.eventBus.subscribe(EventType.PAYMENT_COMPLETED, (e) => this.onPaymentCompleted(e));
    this.eventBus.subscribe(EventType.PAYMENT_REFUNDED, (e) => this.onPaymentRefunded(e));
    this.eventBus.subscribe(EventType.PAYMENT_FAILED, (e) => this.onPaymentFailed(e));
  }

  private async onPaymentCompleted(event: DomainEvent): Promise<void> {
    const payload = event.payload as PaymentCompletedPayload;
    await this.db.execute(
      `INSERT INTO payment_summary (date, total_revenue, total_transactions, successful_transactions)
       VALUES (DATE(?), ?, 1, 1)
       ON DUPLICATE KEY UPDATE
         total_revenue = total_revenue + VALUES(total_revenue),
         total_transactions = total_transactions + 1,
         successful_transactions = successful_transactions + 1,
         updated_at = NOW()`,
      [payload.paidAt, payload.paidAmount],
    );
  }

  private async onPaymentRefunded(event: DomainEvent): Promise<void> {
    const payload = event.payload as PaymentRefundedPayload;
    await this.db.execute(
      `INSERT INTO payment_summary (date, total_refunds, refund_count)
       VALUES (DATE(?), ?, 1)
       ON DUPLICATE KEY UPDATE
         total_refunds = total_refunds + VALUES(total_refunds),
         refund_count = refund_count + 1,
         updated_at = NOW()`,
      [payload.refundedAt, payload.refundAmount],
    );
  }

  private async onPaymentFailed(_event: DomainEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.db.execute(
      `INSERT INTO payment_summary (date, failed_transactions)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE
         failed_transactions = failed_transactions + 1,
         total_transactions = total_transactions + 1,
         updated_at = NOW()`,
      [today],
    );
  }

  async getDailySummary(startDate: string, endDate: string) {
    return this.db.query<RowDataPacket[]>(
      `SELECT date, total_revenue AS totalRevenue, total_transactions AS totalTransactions,
              successful_transactions AS successfulTransactions, failed_transactions AS failedTransactions,
              total_refunds AS totalRefunds, refund_count AS refundCount
       FROM payment_summary
       WHERE date BETWEEN ? AND ?
       ORDER BY date DESC`,
      [startDate, endDate],
    );
  }

  async getTotalStats() {
    const rows = await this.db.query<RowDataPacket[]>(
      `SELECT
         SUM(total_revenue) AS totalRevenue,
         SUM(total_transactions) AS totalTransactions,
         SUM(successful_transactions) AS successfulTransactions,
         SUM(failed_transactions) AS failedTransactions,
         SUM(total_refunds) AS totalRefunds,
         SUM(refund_count) AS refundCount
       FROM payment_summary`,
    );
    return rows[0] ?? null;
  }
}
