import { RowDataPacket } from 'mysql2/promise';
import { inject, singleton } from 'tsyringe';
import { DatabaseConnectionPool } from '../../config/database';
import { DomainEvent, EventType } from '../../common/types/events';
import { StoredEvent } from '../entities/Event';

@singleton()
export class EventStoreRepository {
  constructor(
    @inject(DatabaseConnectionPool) private db: DatabaseConnectionPool,
  ) {}

  async append(event: DomainEvent): Promise<number> {
    const result = await this.db.execute(
      `INSERT INTO event_store (event_id, event_type, aggregate_id, aggregate_type, payload, version, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.type,
        event.aggregateId,
        event.aggregateType,
        JSON.stringify(event.payload),
        event.version,
        event.occurredAt,
      ],
    );
    return result.insertId;
  }

  async findByAggregateId(aggregateId: string): Promise<StoredEvent[]> {
    return this.db.query<(StoredEvent & RowDataPacket)[]>(
      `SELECT id, event_id AS eventId, event_type AS eventType,
              aggregate_id AS aggregateId, aggregate_type AS aggregateType,
              payload, version, occurred_at AS occurredAt, created_at AS createdAt
       FROM event_store WHERE aggregate_id = ? ORDER BY version ASC`,
      [aggregateId],
    );
  }

  async findByType(eventType: EventType, limit = 50, offset = 0): Promise<StoredEvent[]> {
    return this.db.query<(StoredEvent & RowDataPacket)[]>(
      `SELECT id, event_id AS eventId, event_type AS eventType,
              aggregate_id AS aggregateId, aggregate_type AS aggregateType,
              payload, version, occurred_at AS occurredAt, created_at AS createdAt
       FROM event_store WHERE event_type = ? ORDER BY occurred_at DESC LIMIT ? OFFSET ?`,
      [eventType, limit, offset],
    );
  }

  async findRecent(limit = 100): Promise<StoredEvent[]> {
    return this.db.query<(StoredEvent & RowDataPacket)[]>(
      `SELECT id, event_id AS eventId, event_type AS eventType,
              aggregate_id AS aggregateId, aggregate_type AS aggregateType,
              payload, version, occurred_at AS occurredAt, created_at AS createdAt
       FROM event_store ORDER BY occurred_at DESC LIMIT ?`,
      [limit],
    );
  }

  async getLatestVersion(aggregateId: string): Promise<number> {
    const rows = await this.db.query<RowDataPacket[]>(
      'SELECT MAX(version) AS latestVersion FROM event_store WHERE aggregate_id = ?',
      [aggregateId],
    );
    return rows[0]?.latestVersion ?? 0;
  }
}
