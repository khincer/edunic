'use client';

import { getSession } from './auth';
import { API_BASE_URL } from './config';

export type ApiListResponse<T> = {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type ApiSingleResponse<T> = {
  data: T;
};

export type Institution = {
  id: string;
  name: string;
  createdAt: string;
};

export type Classroom = {
  id: string;
  institutionId: string;
  gradeLevel: number;
  section: string | null;
  name: string;
};

export type Enrollment = {
  id: string;
  institutionId: string;
  studentId: string;
  academicPeriodId: string;
  classroomId: string | null;
  status: 'active' | 'withdrawn' | 'completed';
  promotionStatus: string | null;
  createdAt: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
};

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type AttendanceRecord = {
  id: string;
  institutionId: string;
  enrollmentId: string;
  date: string;
  status: AttendanceStatus;
  createdAt: string | null;
};

export type Grade = {
  id: string;
  institutionId: string;
  enrollmentId: string;
  subject: string;
  score: number;
  createdAt: string | null;
};

export type Extension = {
  key: string;
  name: string | null;
  enabled: boolean;
};

export type InstitutionExtension = {
  institutionId: string;
  extensionKey: string;
  config: Record<string, unknown>;
  extension: Extension;
};

export type AuditLog = {
  id: string;
  institutionId: string;
  userId: string | null;
  action: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  institutionId?: string;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  if (options.institutionId) {
    headers['x-institution-id'] = options.institutionId;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload), response.status, payload);
  }

  return payload as T;
}

async function readPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return 'The API request failed';
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const value = query.toString();
  return value ? `?${value}` : '';
}
