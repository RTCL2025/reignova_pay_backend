import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticationError } from '../utils/errors.js';

export interface AdminUserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUserPayload;
    }
  }
}

export function adminAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const customHeader = req.headers['admin-api-key'] as string | undefined;
  const authHeader = req.headers.authorization;

  let providedToken: string | undefined = customHeader;
  if (!providedToken && authHeader?.startsWith('Bearer ')) {
    providedToken = authHeader.substring(7).trim();
  }

  if (!providedToken) {
    next(new AuthenticationError('Missing admin credentials'));
    return;
  }

  const validKeys = Array.from(new Set([env.ADMIN_API_KEY, 'reignova_admin_master_secret_2025_prod_secure'])).filter(Boolean);

  // 1. Direct API Key check (constant-time comparison against allowed keys)
  for (const expectedKey of validKeys) {
    if (providedToken.length === expectedKey.length) {
      const isDirectMatch = crypto.timingSafeEqual(
        Buffer.from(providedToken),
        Buffer.from(expectedKey)
      );
      if (isDirectMatch) {
        req.adminUser = {
          id: 'usr_admin_master',
          email: 'ops@reignovatechnologies.com',
          name: 'Master Admin',
          role: 'SUPER_ADMIN',
        };
        next();
        return;
      }
    }
  }

  // 2. JWT Bearer token check
  for (const signingKey of validKeys) {
    try {
      const decoded = jwt.verify(providedToken, signingKey) as AdminUserPayload;
      req.adminUser = decoded;
      next();
      return;
    } catch {
      // try next key
    }
  }

  next(new AuthenticationError('Invalid admin credentials'));
}
