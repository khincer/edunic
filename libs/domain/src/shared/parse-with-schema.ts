import { ZodError, type ZodType } from 'zod';
import { ValidationError } from './app-error.js';

export function parseWithSchema<T>(
  schema: ZodType<T>,
  value: unknown,
  ErrorClass: new (
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) => Error = ValidationError
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new ErrorClass(
        firstIssue?.message ?? 'Invalid request',
        400,
        toErrorDetails(error)
      );
    }
    throw error;
  }
}

function toErrorDetails(error: ZodError) {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}
