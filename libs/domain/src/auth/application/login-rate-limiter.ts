const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;

type LoginAttemptState = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
};

type LoginRateLimiterOptions = {
  maxAttempts?: number;
  windowMs?: number;
  lockMs?: number;
};

export class LoginRateLimitError extends Error {
  readonly statusCode = 429;

  constructor() {
    super('Too many login attempts. Try again later.');
    this.name = 'LoginRateLimitError';
  }
}

export class LoginRateLimiter {
  private readonly attempts = new Map<string, LoginAttemptState>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockMs: number;

  constructor(options: LoginRateLimiterOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.lockMs = options.lockMs ?? DEFAULT_LOCK_MS;
  }

  assertAllowed(ipAddress: string, email: string) {
    const key = this.getKey(ipAddress, email);
    const state = this.getCurrentState(key);

    if (state?.lockedUntil && state.lockedUntil > Date.now()) {
      throw new LoginRateLimitError();
    }
  }

  recordFailure(ipAddress: string, email: string) {
    const key = this.getKey(ipAddress, email);
    const now = Date.now();
    const state = this.getCurrentState(key);
    const nextState: LoginAttemptState = state ?? {
      attempts: 0,
      firstAttemptAt: now,
      lockedUntil: null,
    };

    nextState.attempts += 1;

    if (nextState.attempts >= this.maxAttempts) {
      nextState.lockedUntil = now + this.lockMs;
    }

    this.attempts.set(key, nextState);
  }

  reset(ipAddress: string, email: string) {
    this.attempts.delete(this.getKey(ipAddress, email));
  }

  private getCurrentState(key: string) {
    const state = this.attempts.get(key);

    if (!state) {
      return null;
    }

    const now = Date.now();
    const windowExpired = now - state.firstAttemptAt > this.windowMs;
    const lockExpired = state.lockedUntil !== null && state.lockedUntil <= now;

    if (windowExpired || lockExpired) {
      this.attempts.delete(key);
      return null;
    }

    return state;
  }

  private getKey(ipAddress: string, email: string) {
    return `${ipAddress}:${email.trim().toLowerCase()}`;
  }
}
