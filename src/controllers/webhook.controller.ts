import { Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service.js';
import { sendSuccess } from '../utils/response.js';

export class WebhookController {
  async handlePawapay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = (req.body as Record<string, unknown>) || {};
      if (body.checkoutId) {
        return await this.handlePawapayCheckout(req, res, next);
      }
      if (body.payoutId) {
        return await this.handlePawapayPayout(req, res, next);
      }
      if (body.refundId) {
        return await this.handlePawapayRefund(req, res, next);
      }

      const result = await webhookService.processPawapayCallback(
        req.headers,
        req.body,
        req.rawBody,
        req.ip
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async handlePawapayPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await webhookService.processPawapayPayoutCallback(
        req.headers,
        req.body,
        req.rawBody,
        req.ip
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async handlePawapayRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await webhookService.processPawapayRefundCallback(
        req.headers,
        req.body,
        req.rawBody,
        req.ip
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async handlePawapayCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await webhookService.processPawapayCheckoutCallback(
        req.headers,
        req.body,
        req.rawBody,
        req.ip
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const webhookController = new WebhookController();
export default webhookController;
