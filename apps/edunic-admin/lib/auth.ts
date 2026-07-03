'use client';

import { API_BASE_URL } from './config';

export type AdminSession = {
  token: string;
  user: {
    id: string;
    email: string;
    institutionId: string;
    role: string;
  };
};

export type LoginInput = {
  email: string;
  password: string;
  institutionId: string;
};

type LoginResponse = {
  data: AdminSession;
};

export const SESSION_STORAGE_KEY = 'edunic-admin-session';
const SESSION_EVENT_NAME = 'edunic-admin-session-change';
let cachedSessionRaw: string | null = null;
let cachedSession: AdminSession | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getSession(): AdminSession | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!value) {
    resetCachedSession();
    return null;
  }

  if (value === cachedSessionRaw) {
    if (cachedSession && !isSessionExpired(cachedSession)) {
      return cachedSession;
    }

    removeStoredSession();
    return null;
  }

  try {
    cachedSessionRaw = value;
    cachedSession = JSON.parse(value) as AdminSession;

    if (isSessionExpired(cachedSession)) {
      removeStoredSession();
      return null;
    }

    return cachedSession;
  } catch {
    removeStoredSession();
    return null;
  }
}

export function saveSession(session: AdminSession) {
  const value = JSON.stringify(session);
  cachedSessionRaw = value;
  cachedSession = session;
  window.localStorage.setItem(SESSION_STORAGE_KEY, value);
  window.dispatchEvent(new Event(SESSION_EVENT_NAME));
}

export function clearSession() {
  removeStoredSession();
  window.dispatchEvent(new Event(SESSION_EVENT_NAME));
}

export function onSessionChange(callback: () => void) {
  window.addEventListener(SESSION_EVENT_NAME, callback);
  window.addEventListener('storage', callback);

  return () => {
    window.removeEventListener(SESSION_EVENT_NAME, callback);
    window.removeEventListener('storage', callback);
  };
}

export async function login(input: LoginInput) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | LoginResponse
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(getLoginErrorMessage(payload));
  }

  const session = (payload as LoginResponse).data;
  saveSession(session);
  return session;
}

function getLoginErrorMessage(payload: LoginResponse | { message?: string } | null) {
  if (payload && 'message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  return 'Unable to sign in';
}

function resetCachedSession() {
  cachedSessionRaw = null;
  cachedSession = null;
}

function removeStoredSession() {
  resetCachedSession();
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function isSessionExpired(session: AdminSession) {
  const payload = decodeJwtPayload(session.token);

  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }

  return payload.exp <= Math.floor(Date.now() / 1000);
}

function decodeJwtPayload(token: string) {
  const [, encodedPayload] = token.split('.');

  if (!encodedPayload) {
    return null;
  }

  try {
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '='
    );

    return JSON.parse(window.atob(padded)) as { exp?: unknown };
  } catch {
    return null;
  }
}
