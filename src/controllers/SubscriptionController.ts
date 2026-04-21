import { Request, Response, NextFunction } from 'express';
import { inject, singleton } from 'tsyringe';
import { SubscriptionHandler } from '../handlers/SubscriptionHandler';

@singleton()
export class SubscriptionController {
  constructor(
    @inject(SubscriptionHandler) private subHandler: SubscriptionHandler,
  ) {}

  createSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, planId, plan } = req.body;
      const subscriptionId = await this.subHandler.createSubscription({ userId, planId, plan });
      res.status(201).json({ success: true, data: { subscriptionId } });
    } catch (error) {
      next(error);
    }
  };

  cancelSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscriptionId = req.params.subscriptionId as string;
      const { reason } = req.body;
      await this.subHandler.cancelSubscription(subscriptionId, reason);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  getSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sub = await this.subHandler.getSubscription(req.params.subscriptionId as string);
      res.json({ success: true, data: sub });
    } catch (error) {
      next(error);
    }
  };

  getActiveSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sub = await this.subHandler.getActiveSubscription(req.params.userId as string);
      res.json({ success: true, data: sub });
    } catch (error) {
      next(error);
    }
  };
}
