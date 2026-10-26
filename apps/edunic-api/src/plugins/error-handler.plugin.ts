import { randomUUID } from 'node:crypto';
import type { FastifyError, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createErrorEnvelope, ErrorCode } from '@edunic/source/domain/shared';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

const errorHandlerPluginHandler: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request) => {
    request.correlationId = randomUUID();
    // P4-R5/D6: every request-scoped log line carries the correlation id that
    // also lands in the error envelope.
    request.log = request.log.child({ correlationId: request.correlationId });
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const statusCode = resolveStatusCode(error);
    const isExpected = typeof error.statusCode === 'number';

    request.log.error({
      err: error,
      correlationId: request.correlationId ?? String(request.id),
    });

    reply.status(statusCode).send(
      createErrorEnvelope(
        resolveErrorCode(statusCode),
        isExpected ? error.message : 'Internal Server Error',
        request.correlationId ?? String(request.id),
        resolveDetails(error, isExpected)
      )
    );
  });
};

function resolveStatusCode(error: { statusCode?: number }) {
  const statusCode = error.statusCode;

  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }

  return 500;
}

// Unmapped statuses fall back to a client-error code for 4xx and INTERNAL_ERROR
// for 5xx. 429 (login rate limit) is not part of the stable set, so it keeps its
// HTTP status while reusing the generic client-error code.
function resolveErrorCode(statusCode: number) {
  const mapped = CODE_BY_STATUS[statusCode];

  if (mapped) {
    return mapped;
  }

  return statusCode >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_ERROR;
}

// Only expected (domain) errors may expose details; unexpected errors keep the
// generic 500 body so internals never leak to clients.
function resolveDetails(
  error: { statusCode?: number; details?: Record<string, unknown> },
  isExpected: boolean
) {
  if (!isExpected) {
    return undefined;
  }

  return typeof error.details === 'object' && error.details !== null
    ? error.details
    : undefined;
}

export const errorHandlerPlugin = fp(errorHandlerPluginHandler, {
  name: 'error-handler-plugin',
});
