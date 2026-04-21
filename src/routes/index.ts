import { Router } from 'express';
import { container } from 'tsyringe';
import { PaymentController } from '../controllers/PaymentController';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { EventController } from '../controllers/EventController';

export function createRouter(): Router {
  const router = Router();
  const paymentCtrl = container.resolve(PaymentController);
  const subCtrl = container.resolve(SubscriptionController);
  const eventCtrl = container.resolve(EventController);

  // Payment endpoints
  router.post('/api/v1/payments', paymentCtrl.createPayment);
  router.post('/api/v1/payments/complete', paymentCtrl.completePayment);
  router.post('/api/v1/payments/:orderNumber/refund', paymentCtrl.refundPayment);
  router.get('/api/v1/payments/:orderNumber', paymentCtrl.getPayment);
  router.get('/api/v1/users/:userId/payments', paymentCtrl.getUserPayments);

  // Subscription endpoints
  router.post('/api/v1/subscriptions', subCtrl.createSubscription);
  router.post('/api/v1/subscriptions/:subscriptionId/cancel', subCtrl.cancelSubscription);
  router.get('/api/v1/subscriptions/:subscriptionId', subCtrl.getSubscription);
  router.get('/api/v1/users/:userId/subscription', subCtrl.getActiveSubscription);

  // Event & Stats endpoints (CQRS read side)
  router.get('/api/v1/events/recent', eventCtrl.getRecentEvents);
  router.get('/api/v1/events/type/:type', eventCtrl.getEventsByType);
  router.get('/api/v1/events/aggregate/:aggregateId', eventCtrl.getEventsByAggregate);
  router.get('/api/v1/stats/daily', eventCtrl.getDailySummary);
  router.get('/api/v1/stats/total', eventCtrl.getTotalStats);

  // Health check
  router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  return router;
}
