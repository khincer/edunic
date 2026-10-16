export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Marker value written by SET NX before the response is known. */
const IN_PROGRESS_MARKER = 'in-progress';

export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IdempotencyScope {
  institutionId: string;
  route: string;
  actorId: string;
  key: string;
}

export type IdempotencyLookup =
  | { type: 'miss' }
  | { type: 'in-flight' }
  | { type: 'replay'; status: number; payload: string };

export function buildIdempotencyKey(scope: IdempotencyScope): string {
  return [
    'idempotency',
    scope.institutionId,
    scope.route,
    scope.actorId,
    scope.key,
  ].join(':');
}

/**
 * Claims the key on first use; a marker without a stored response means a
 * concurrent duplicate is still executing, and a stored response replays.
 */
export async function lookupIdempotency(
  store: IdempotencyStore,
  key: string
): Promise<IdempotencyLookup> {
  const stored = await store.get(key);

  if (stored === null) {
    const claimed = await store.setNx(
      key,
      IN_PROGRESS_MARKER,
      IDEMPOTENCY_TTL_SECONDS
    );

    return claimed ? { type: 'miss' } : { type: 'in-flight' };
  }

  if (stored === IN_PROGRESS_MARKER) {
    return { type: 'in-flight' };
  }

  const storedResponse = parseStoredResponse(stored);

  if (!storedResponse) {
    return { type: 'in-flight' };
  }

  return { type: 'replay', ...storedResponse };
}

export async function storeIdempotentResponse(
  store: IdempotencyStore,
  key: string,
  status: number,
  payload: string
): Promise<void> {
  await store.set(
    key,
    JSON.stringify({ status, payload }),
    IDEMPOTENCY_TTL_SECONDS
  );
}

/**
 * Releases the in-progress claim without storing a response, so a failed
 * attempt can be retried with the same key instead of conflicting for 24h.
 */
export async function releaseIdempotencyKey(
  store: IdempotencyStore,
  key: string
): Promise<void> {
  await store.delete(key);
}

function parseStoredResponse(
  stored: string
): { status: number; payload: string } | null {
  try {
    const parsed: unknown = JSON.parse(stored);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { status?: unknown }).status !== 'number' ||
      typeof (parsed as { payload?: unknown }).payload !== 'string'
    ) {
      return null;
    }

    return parsed as { status: number; payload: string };
  } catch {
    return null;
  }
}
