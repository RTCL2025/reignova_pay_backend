import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { RateLimitError } from '../utils/errors.js';

export const publicRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_PUBLIC_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new RateLimitError('Public endpoint rate limit exceeded'));
  }
});

export const authenticatedRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const authReq = req as unknown as AuthenticatedRequest;
    return authReq.application?.id || req.ip || 'anonymous';
  },
  handler: (_req, _res, next) => {
    next(new RateLimitError('Application API rate limit exceeded'));
  }
});

export const webhookRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_WEBHOOK_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'webhook',
  handler: (_req, _res, next) => {
    next(new RateLimitError('Webhook rate limit exceeded'));
  }
});
