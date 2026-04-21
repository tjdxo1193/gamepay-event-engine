import { inject, singleton } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, EventType } from '../common/types/events';
import { EventStoreRepository } from '../models/repositories/EventStoreRepository';

type EventHandler = (event: DomainEvent) => Promise<void>;

@singleton()
export class EventBus {
  private handlers = new Map<EventType, EventHandler[]>();

  constructor(
    @inject(EventStoreRepository) private eventStore: EventStoreRepository,
  ) {}

  subscribe(eventType: EventType, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  async publish<T>(
    type: EventType,
    aggregateId: string,
    aggregateType: string,
    payload: T,
  ): Promise<DomainEvent<T>> {
    const version = await this.eventStore.getLatestVersion(aggregateId) + 1;

    const event: DomainEvent<T> = {
      id: uuidv4(),
      type,
      aggregateId,
      aggregateType,
      payload,
      occurredAt: new Date(),
      version,
    };

    // Persist event to event store
    await this.eventStore.append(event as DomainEvent);

    // Dispatch to local handlers
    const handlers = this.handlers.get(type) || [];
    await Promise.allSettled(
      handlers.map((handler) => handler(event as DomainEvent)),
    );

    return event;
  }
}
