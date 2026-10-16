import {
  buildIdempotencyKey,
  lookupIdempotency,
  storeIdempotentResponse,
  releaseIdempotencyKey,
  IDEMPOTENCY_TTL_SECONDS,
  type IdempotencyStore,
} from '@edunic/source/domain/shared';

function createFakeStore() {
  const entries = new Map<string, string>();
  const ttls = new Map<string, number>();

  const store: IdempotencyStore = {
    get: async (key) => entries.get(key) ?? null,
    setNx: async (key, value, ttlSeconds) => {
      if (entries.has(key)) {
        return false;
      }
      entries.set(key, value);
      ttls.set(key, ttlSeconds);
      return true;
    },
    set: async (key, value, ttlSeconds) => {
      entries.set(key, value);
      ttls.set(key, ttlSeconds);
    },
    delete: async (key) => {
      entries.delete(key);
      ttls.delete(key);
    },
  };

  return { entries, ttls, store };
}

const baseKey = {
  institutionId: 'inst-1',
  route: 'POST /students',
  actorId: 'user-1',
  key: 'client-abc',
};

describe('idempotency key scoping', () => {
  it('builds a key scoped by institution, route, actor, and client key', () => {
    const scoped = buildIdempotencyKey(baseKey);

    expect(scoped).toContain('inst-1');
    expect(scoped).toContain('POST /students');
    expect(scoped).toContain('user-1');
    expect(scoped).toContain('client-abc');
  });

  it('produces distinct keys when any single scope component changes', () => {
    const scoped = buildIdempotencyKey(baseKey);

    expect(buildIdempotencyKey({ ...baseKey, institutionId: 'inst-2' })).not.toBe(scoped);
    expect(buildIdempotencyKey({ ...baseKey, route: 'PATCH /students' })).not.toBe(scoped);
    expect(buildIdempotencyKey({ ...baseKey, actorId: 'user-2' })).not.toBe(scoped);
    expect(buildIdempotencyKey({ ...baseKey, key: 'client-xyz' })).not.toBe(scoped);
    expect(buildIdempotencyKey(baseKey)).toBe(scoped);
  });
});

describe('lookupIdempotency', () => {
  it('reports a miss and claims the key with a 24h-TTL marker on first use', async () => {
    const { entries, ttls, store } = createFakeStore();
    const key = buildIdempotencyKey(baseKey);

    const lookup = await lookupIdempotency(store, key);

    expect(lookup).toEqual({ type: 'miss' });
    expect(entries.has(key)).toBe(true);
    expect(ttls.get(key)).toBe(IDEMPOTENCY_TTL_SECONDS);
  });

  it('flags an in-flight duplicate while the marker has no stored response', async () => {
    const { store } = createFakeStore();
    const key = buildIdempotencyKey(baseKey);

    await lookupIdempotency(store, key);
    const second = await lookupIdempotency(store, key);

    expect(second).toEqual({ type: 'in-flight' });
  });

  it('replays the original stored response byte-for-byte', async () => {
    const { store } = createFakeStore();
    const key = buildIdempotencyKey(baseKey);
    const originalBody = '{"data":{"id":"student-1"}}';

    await lookupIdempotency(store, key);
    await storeIdempotentResponse(store, key, 201, originalBody);

    const replay = await lookupIdempotency(store, key);

    expect(replay).toEqual({ type: 'replay', status: 201, payload: originalBody });
  });

  it('replays empty-payload successes such as 204 responses', async () => {
    const { store } = createFakeStore();
    const key = buildIdempotencyKey(baseKey);

    await lookupIdempotency(store, key);
    await storeIdempotentResponse(store, key, 204, '');

    const replay = await lookupIdempotency(store, key);

    expect(replay).toEqual({ type: 'replay', status: 204, payload: '' });
  });

  it('treats a corrupt stored value as in-flight instead of re-executing', async () => {
    const { store } = createFakeStore();
    const key = buildIdempotencyKey(baseKey);

    await lookupIdempotency(store, key);
    await store.set(key, 'not-a-stored-response', IDEMPOTENCY_TTL_SECONDS);

    const lookup = await lookupIdempotency(store, key);

    expect(lookup).toEqual({ type: 'in-flight' });
  });
});

describe('releaseIdempotencyKey', () => {
  it('frees the claim so the same key can be retried', async () => {
    const { store } = createFakeStore();
    const key = buildIdempotencyKey(baseKey);

    await lookupIdempotency(store, key);
    await releaseIdempotencyKey(store, key);

    const retry = await lookupIdempotency(store, key);

    expect(retry).toEqual({ type: 'miss' });
  });
});
