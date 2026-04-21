import { EventType } from '../../common/types/events';

export interface StoredEvent {
  id: number;
  eventId: string;
  eventType: EventType;
  aggregateId: string;
  aggregateType: string;
  payload: string; // JSON string
  version: number;
  occurredAt: Date;
  createdAt: Date;
}
