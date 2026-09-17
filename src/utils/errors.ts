export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_SERVER_ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Invalid or missing authentication credentials') {
    super(message, 401, 'AUTHENTICATION_FAILED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access to requested resource is forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', identifier?: string) {
    const message = identifier ? `${resource} '${identifier}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict detected', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class IdempotencyError extends AppError {
  constructor(
    message = 'An identical request is currently processing or already completed with different parameters',
    details?: unknown
  ) {
    super(message, 409, 'IDEMPOTENCY_CONFLICT', details);
  }
}

export class InvalidStateTransitionError extends AppError {
  public readonly fromStatus: string;
  public readonly toStatus: string;

  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition payment status from '${fromStatus}' to '${toStatus}'`,
      422,
      'INVALID_STATE_TRANSITION',
      { fromStatus, toStatus }
    );
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export class ProviderError extends AppError {
  public readonly provider: string;
  public readonly rawResponse?: unknown;

  constructor(
    message: string,
    provider = 'pawapay',
    statusCode = 502,
    rawResponse?: unknown
  ) {
    super(message, statusCode, 'PROVIDER_ERROR', { provider, rawResponse });
    this.provider = provider;
    this.rawResponse = rawResponse;
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded, please retry later') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}
