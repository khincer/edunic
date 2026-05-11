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
    cachedSessionRaw = null;
    cachedSession = null;
    return null;
  }

  if (value === cachedSessionRaw) {
    return cachedSession;
  }

  try {
    cachedSessionRaw = value;
    cachedSession = JSON.parse(value) as AdminSession;
    return cachedSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    cachedSessionRaw = null;
    cachedSession = null;
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
  cachedSessionRaw = null;
  cachedSession = null;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
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
