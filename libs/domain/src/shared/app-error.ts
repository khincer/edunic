export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Signature mirrors the parseWithSchema ErrorClass contract
// (message, statusCode, details) so it works as the default error class.
export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    super(message, statusCode, details);
    this.name = 'ValidationError';
  }
}
