import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AuthenticationError } from '../utils/errors.js';

export function adminAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Check Admin-Api-Key header or Authorization: Bearer <key>
  const customHeader = req.headers['admin-api-key'] as string | undefined;
  const authHeader = req.headers.authorization;

  let providedKey: string | undefined = customHeader;
  if (!providedKey && authHeader?.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7).trim();
  }

  if (!providedKey) {
    next(new AuthenticationError('Missing admin credentials'));
    return;
  }

  const expectedKey = env.ADMIN_API_KEY;

  // Constant time comparison
  const isValid =
    providedKey.length === expectedKey.length &&
    crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));

  if (!isValid) {
    next(new AuthenticationError('Invalid admin credentials'));
    return;
  }

  next();
}
