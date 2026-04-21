import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { singleton } from 'tsyringe';
import { env } from './env';

@singleton()
export class DatabaseConnectionPool {
  private pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      connectionLimit: env.db.connectionLimit,
      waitForConnections: true,
      queueLimit: 2000,
      idleTimeout: 60000,
    });
  }

  async query<T extends RowDataPacket[]>(sql: string, params?: unknown[]): Promise<T> {
    const [rows] = await this.pool.query<T>(sql, params);
    return rows;
  }

  async execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params as any);
    return result;
  }

  async getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  async transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
