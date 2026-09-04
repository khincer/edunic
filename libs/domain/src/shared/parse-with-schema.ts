import { ZodError, type ZodType } from 'zod';
import { ValidationError } from './app-error.js';

export function parseWithSchema<T>(
  schema: ZodType<T>,
  value: unknown,
  ErrorClass: new (message: string, statusCode: number) => Error = ValidationError
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new ErrorClass(firstIssue?.message ?? 'Invalid request', 400);
    }
    throw error;
  }
}
