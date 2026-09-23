import { Request, Response, NextFunction } from 'express';
import { webhookService, CallbackRequestInfo } from '../services/webhook.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Captures the request components pawaPay covers with its RFC-9421 signature.
 *
 * `originalUrl` rather than `req.path`, because the signature is computed over
 * the full path the client addressed — mounting under `/api/v1/webhooks` means
 * `req.path` is only the router-relative tail. The `host` header is what pawaPay
 * signed as `@authority`; behind Cloudflare that is still the public hostname.
 */
function requestInfoFrom(req: Request): CallbackRequestInfo {
  return {
    method: req.method,
    authority: req.get('host') || undefined,
    path: req.originalUrl
  };
}

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
        req.ip,
        requestInfoFrom(req)
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
        req.ip,
        requestInfoFrom(req)
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
        req.ip,
        requestInfoFrom(req)
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
        req.ip,
        requestInfoFrom(req)
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const webhookController = new WebhookController();
export default webhookController;
