import { z } from 'zod';
import {
  parseWithSchema,
  ValidationError,
  AppError,
} from '@edunic/source/domain/shared';

describe('parseWithSchema', () => {
  const simpleSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  it('returns parsed data when schema is valid', () => {
    const result = parseWithSchema(simpleSchema, { name: 'Ana', age: 25 });
    expect(result).toEqual({ name: 'Ana', age: 25 });
  });

  it('throws ValidationError on invalid data', () => {
    expect(() =>
      parseWithSchema(simpleSchema, { name: 123, age: 'old' })
    ).toThrow(ValidationError);
  });

  it('includes Zod error message in the thrown error', () => {
    try {
      parseWithSchema(simpleSchema, { name: 123 });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(400);
      expect((error as Error).message).toBeTruthy();
    }
  });

  it('accepts custom error class', () => {
    class CustomError extends Error {
      constructor(message: string, public readonly statusCode: number) {
        super(message);
      }
    }

    expect(() => parseWithSchema(simpleSchema, {}, CustomError)).toThrow(
      CustomError
    );
  });

  it('attaches the zod issues as error details', () => {
    try {
      parseWithSchema(simpleSchema, { name: 123 });
      throw new Error('expected parseWithSchema to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);

      const details = (error as ValidationError).details as {
        issues: { path: string; message: string }[];
      };

      expect(details.issues).toHaveLength(2);
      expect(details.issues[0]).toMatchObject({ path: 'name' });
      expect(details.issues[1]).toMatchObject({ path: 'age' });
    }
  });

  it('re-throws non-Zod errors unchanged', () => {
    const throwingSchema = {
      parse: () => {
        throw new Error('DB connection failed');
      },
    };

    expect(() => parseWithSchema(throwingSchema as never, null)).toThrow(
      'DB connection failed'
    );
  });
});
