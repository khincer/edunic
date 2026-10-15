export interface EnvelopeLinks {
  next?: string;
  prev?: string;
  self?: string;
}

export interface ResponseEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  links?: EnvelopeLinks;
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export interface ErrorEnvelope {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
}

export function createEnvelope<T>(
  data: T,
  meta?: Record<string, unknown>,
  links?: EnvelopeLinks
): ResponseEnvelope<T> {
  return {
    data,
    ...(meta ? { meta } : {}),
    ...(links ? { links } : {}),
  };
}

export function createErrorEnvelope(
  code: ErrorCode,
  message: string,
  correlationId: string,
  details?: Record<string, unknown>
): ErrorEnvelope {
  return {
    code,
    message,
    ...(details ? { details } : {}),
    correlationId,
  };
}
