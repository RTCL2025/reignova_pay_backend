import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandlerMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  // Operational AppErrors
  if (err instanceof AppError) {
    logger.warn(
      {
        requestId,
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        details: err.details,
        path: req.path,
        method: req.method
      },
      err.message
    );

    sendError(res, err.errorCode, err.message, err.statusCode, err.details, requestId);
    return;
  }

  // Body parser syntax error (malformed JSON)
  if ('type' in err && err.type === 'entity.parse.failed') {
    logger.warn({ requestId, path: req.path }, 'Malformed JSON body');
    sendError(res, 'MALFORMED_JSON', 'Malformed JSON in request body', 400, undefined, requestId);
    return;
  }

  // Database unique constraint violation
  if (err.name === 'SequelizeUniqueConstraintError') {
    logger.warn({ requestId, err: err.message }, 'Database unique constraint violation');
    sendError(res, 'CONFLICT', 'Resource already exists or constraint violated', 409, undefined, requestId);
    return;
  }

  // Unhandled / Unexpected Errors
  logger.error(
    {
      requestId,
      err: {
        name: err.name,
        message: err.message,
        stack: env.NODE_ENV === 'production' ? undefined : err.stack
      },
      path: req.path,
      method: req.method
    },
    'Unhandled server exception'
  );

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred'
      : err.message || 'Internal Server Error';

  sendError(res, 'INTERNAL_SERVER_ERROR', message, 500, undefined, requestId);
}
