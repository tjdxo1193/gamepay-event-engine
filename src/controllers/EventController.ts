import { Request, Response, NextFunction } from 'express';
import { inject, singleton } from 'tsyringe';
import { EventStoreRepository } from '../models/repositories/EventStoreRepository';
import { PaymentSummaryProjector } from '../workers/PaymentSummaryProjector';
import { EventType } from '../common/types/events';

@singleton()
export class EventController {
  constructor(
    @inject(EventStoreRepository) private eventStore: EventStoreRepository,
    @inject(PaymentSummaryProjector) private projector: PaymentSummaryProjector,
  ) {}

  getEventsByAggregate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = await this.eventStore.findByAggregateId(req.params.aggregateId as string);
      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  };

  getRecentEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await this.eventStore.findRecent(limit);
      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  };

  getEventsByType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventType = req.params.type as EventType;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const events = await this.eventStore.findByType(eventType, limit, offset);
      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  };

  getDailySummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await this.projector.getDailySummary(startDate as string, endDate as string);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  };

  getTotalStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.projector.getTotalStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  };
}
