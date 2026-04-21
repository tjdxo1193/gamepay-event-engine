import { RowDataPacket } from 'mysql2/promise';
import { inject, singleton } from 'tsyringe';
import { DatabaseConnectionPool } from '../../config/database';
import { Payment } from '../entities/Payment';
import { PaymentStatus } from '../../common/types/payment';

@singleton()
export class PaymentRepository {
  constructor(
    @inject(DatabaseConnectionPool) private db: DatabaseConnectionPool,
  ) {}

  async create(payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const result = await this.db.execute(
      `INSERT INTO payments (order_number, user_id, product_id, amount, currency, status, transaction_id, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.orderNumber,
        payment.userId,
        payment.productId,
        payment.amount,
        payment.currency,
        payment.status,
        payment.transactionId,
        payment.paidAt,
      ],
    );
    return result.insertId;
  }

  async findByOrderNumber(orderNumber: string): Promise<Payment | null> {
    const rows = await this.db.query<(Payment & RowDataPacket)[]>(
      `SELECT id, order_number AS orderNumber, user_id AS userId, product_id AS productId,
              amount, currency, status, transaction_id AS transactionId,
              paid_at AS paidAt, refunded_at AS refundedAt,
              refund_amount AS refundAmount, refund_reason AS refundReason,
              created_at AS createdAt, updated_at AS updatedAt
       FROM payments WHERE order_number = ?`,
      [orderNumber],
    );
    return rows[0] ?? null;
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<Payment[]> {
    return this.db.query<(Payment & RowDataPacket)[]>(
      `SELECT id, order_number AS orderNumber, user_id AS userId, product_id AS productId,
              amount, currency, status, transaction_id AS transactionId,
              paid_at AS paidAt, refunded_at AS refundedAt,
              refund_amount AS refundAmount, refund_reason AS refundReason,
              created_at AS createdAt, updated_at AS updatedAt
       FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
  }

  async updateStatus(orderNumber: string, status: PaymentStatus, extra?: Record<string, any>): Promise<void> {
    const sets = ['status = ?'];
    const params: any[] = [status];

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        const column = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        sets.push(`${column} = ?`);
        params.push(value);
      }
    }

    params.push(orderNumber);
    await this.db.execute(
      `UPDATE payments SET ${sets.join(', ')}, updated_at = NOW() WHERE order_number = ?`,
      params,
    );
  }

  async existsByOrderNumber(orderNumber: string): Promise<boolean> {
    const rows = await this.db.query<RowDataPacket[]>(
      'SELECT 1 FROM payments WHERE order_number = ? LIMIT 1',
      [orderNumber],
    );
    return rows.length > 0;
  }
}
