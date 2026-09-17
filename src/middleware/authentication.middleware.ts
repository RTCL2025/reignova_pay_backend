import { Response, NextFunction } from 'express';
import { applicationRepository } from '../repositories/application.repository.js';
import { ApplicationStatus } from '../models/application.model.js';
import { hashApiKey } from '../utils/crypto.js';
import { AuthenticationError, ForbiddenError } from '../utils/errors.js';
import { AuthenticatedRequest } from '../types/api.types.js';

export async function authenticateApiKey(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AuthenticationError('Missing or malformed Authorization header. Expected Bearer <key>'));
    return;
  }

  const apiKey = authHeader.substring(7).trim();

  // Validate format: must start with pk_live_ or pk_test_
  if (!apiKey.startsWith('pk_live_') && !apiKey.startsWith('pk_test_')) {
    next(new AuthenticationError('Invalid API key format'));
    return;
  }

  try {
    const keyHash = hashApiKey(apiKey);
    const application = await applicationRepository.findByApiKeyHash(keyHash);

    if (!application) {
      next(new AuthenticationError('Invalid API key'));
      return;
    }

    if (application.status === ApplicationStatus.SUSPENDED) {
      next(new ForbiddenError('Application is currently suspended'));
      return;
    }

    if (application.status === ApplicationStatus.REVOKED) {
      next(new ForbiddenError('Application access has been revoked'));
      return;
    }

    // Attach verified application to request
    req.application = application;
    next();
  } catch (error) {
    next(error);
  }
}
