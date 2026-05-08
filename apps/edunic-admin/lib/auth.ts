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

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getSession(): AdminSession | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AdminSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: AdminSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT_NAME));
}

export function clearSession() {
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
