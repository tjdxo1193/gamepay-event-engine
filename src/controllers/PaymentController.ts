import { Request, Response, NextFunction } from 'express';
import { inject, singleton } from 'tsyringe';
import { PaymentHandler } from '../handlers/PaymentHandler';
import { AppError } from '../common/errors/AppError';

@singleton()
export class PaymentController {
  constructor(
    @inject(PaymentHandler) private paymentHandler: PaymentHandler,
  ) {}

  createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, productId, amount, currency } = req.body;
      const orderNumber = await this.paymentHandler.createPayment({ userId, productId, amount, currency });
      res.status(201).json({ success: true, data: { orderNumber } });
    } catch (error) {
      next(error);
    }
  };

  completePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderNumber, transactionId, paidAmount } = req.body;
      await this.paymentHandler.completePayment({ orderNumber, transactionId, paidAmount });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  refundPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderNumber = req.params.orderNumber as string;
      const { refundAmount, reason } = req.body;
      await this.paymentHandler.refundPayment({ orderNumber, refundAmount, reason });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payment = await this.paymentHandler.getPayment(req.params.orderNumber as string);
      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  };

  getUserPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const payments = await this.paymentHandler.getUserPayments(userId, limit, offset);
      res.json({ success: true, data: payments });
    } catch (error) {
      next(error);
    }
  };
}
