import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { createEnvelope } from '@edunic/source/domain/shared';

const envelopePluginHandler: FastifyPluginAsync = async (app) => {
  app.addHook('onSend', async (request, reply, payload) => {
    if (!shouldEnvelope(request, reply, payload)) {
      return payload;
    }

    return wrapPayload(payload);
  });
};

function shouldEnvelope(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown
): payload is string {
  if (typeof payload !== 'string') {
    return false;
  }

  if (reply.statusCode >= 400) {
    return false;
  }

  if (!isJsonPayload(reply)) {
    return false;
  }

  return !isExcludedPath(request.url);
}

function isJsonPayload(reply: FastifyReply) {
  const contentType = reply.getHeader('content-type');
  return (
    typeof contentType === 'string' && contentType.includes('application/json')
  );
}

// Success payloads are already serialized when onSend runs, so the envelope is
// applied to the JSON string. Bodies that already carry a `data` key are left
// untouched so the plugin stays idempotent with enveloped domain responses.
function wrapPayload(payload: string) {
  try {
    const body = JSON.parse(payload);

    if (isEnvelope(body)) {
      return payload;
    }

    return JSON.stringify(createEnvelope(body));
  } catch {
    return payload;
  }
}

function isEnvelope(body: unknown) {
  return (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    'data' in body
  );
}

function isExcludedPath(path: string) {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/docs') ||
    path.startsWith('/health') ||
    path.startsWith('/ready')
  );
}

// Registered after audit-logs in plugins/index.ts so audit captures the raw
// payload first; onSend hooks run in registration order.
export const envelopePlugin = fp(envelopePluginHandler, {
  name: 'envelope-plugin',
});
