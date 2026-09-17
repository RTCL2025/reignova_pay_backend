import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors.js';

export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction): void {
  const key = req.headers['idempotency-key'] as string | undefined;

  if (!key || key.trim() === '') {
    next(new ValidationError('Idempotency-Key header is required for payment creation'));
    return;
  }

  if (key.length > 255) {
    next(new ValidationError('Idempotency-Key cannot exceed 255 characters'));
    return;
  }

  next();
}
