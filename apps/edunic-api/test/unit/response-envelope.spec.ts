import {
  ErrorCode,
  createEnvelope,
  createErrorEnvelope,
} from '@edunic/source/domain/shared';

describe('response envelope builders', () => {
  describe('createEnvelope', () => {
    it('wraps data in a response envelope', () => {
      expect(createEnvelope({ id: 'abc' })).toEqual({ data: { id: 'abc' } });
    });

    it('includes meta and links when provided', () => {
      const envelope = createEnvelope([1, 2], { total: 2 }, { next: '/next' });

      expect(envelope).toEqual({
        data: [1, 2],
        meta: { total: 2 },
        links: { next: '/next' },
      });
    });

    it('omits meta and links when not provided', () => {
      const envelope = createEnvelope('value');

      expect(envelope).toEqual({ data: 'value' });
      expect('meta' in envelope).toBe(false);
      expect('links' in envelope).toBe(false);
    });
  });

  describe('createErrorEnvelope', () => {
    it('builds an error envelope with a stable code and correlation id', () => {
      expect(
        createErrorEnvelope(ErrorCode.NOT_FOUND, 'Student not found', 'corr-1')
      ).toEqual({
        code: 'NOT_FOUND',
        message: 'Student not found',
        correlationId: 'corr-1',
      });
    });

    it('includes details only when provided', () => {
      const withDetails = createErrorEnvelope(
        ErrorCode.VALIDATION_ERROR,
        'Invalid body',
        'corr-2',
        { field: 'email' }
      );

      expect(withDetails).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid body',
        details: { field: 'email' },
        correlationId: 'corr-2',
      });

      expect('details' in createErrorEnvelope(ErrorCode.CONFLICT, 'Dup', 'corr-3')).toBe(
        false
      );
    });
  });

  describe('ErrorCode', () => {
    it('exposes exactly the eight stable error codes', () => {
      expect(Object.values(ErrorCode).sort()).toEqual([
        'CONFLICT',
        'FORBIDDEN',
        'IDEMPOTENCY_CONFLICT',
        'INTERNAL_ERROR',
        'NOT_FOUND',
        'SERVICE_UNAVAILABLE',
        'UNAUTHORIZED',
        'VALIDATION_ERROR',
      ]);
    });
  });
});
