import { Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service.js';
import { sendSuccess } from '../utils/response.js';

export class WebhookController {
  async handlePawapay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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
}

export const webhookController = new WebhookController();
export default webhookController;
