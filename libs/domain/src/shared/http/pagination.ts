import { sql, type SQL } from 'drizzle-orm';
import { ValidationError } from '../app-error.js';

export interface PaginationParams {
  cursor?: string;
  limit?: number;
  offset?: number; // legacy offset pagination
}

export interface CursorOrderSpec {
  /**
   * Qualified column names in stable order, e.g. ['e.created_at', 'e.id'].
   * Constant literals per resource — never derived from user input.
   */
  columns: readonly string[];
  direction: 'asc' | 'desc';
}

export interface CursorPageMeta {
  total?: number;
  limit: number;
  offset?: number;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  meta?: CursorPageMeta;
}

export interface CursorPaginationPlan {
  /** Keyset WHERE predicate for cursor mode; null in legacy offset mode. */
  keyset: SQL | null;
  /** Stable ORDER BY for cursor mode; null keeps the caller's legacy order. */
  orderBy: SQL | null;
  /** Rows to fetch — one extra sentinel row in cursor mode to detect hasMore. */
  fetchLimit: number;
  /** Offset for legacy mode; null in cursor mode (no OFFSET clause). */
  offset: number | null;
}

export type CursorSortKey = string | readonly string[];

/**
 * Sentinel cursor value requesting the first page in stable keyset order.
 * Real cursors are base64url-encoded JSON and never equal this string.
 */
export const FIRST_PAGE_CURSOR = 'start';

export function encodeCursor(sortKey: CursorSortKey, id: string): string {
  return Buffer.from(JSON.stringify({ k: sortKey, i: id }), 'utf8').toString(
    'base64url'
  );
}

export function decodeCursor(cursor: string): {
  sortKey: string | string[];
  id: string;
} {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError('Invalid pagination cursor');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ValidationError('Invalid pagination cursor');
  }

  const { k, i } = parsed as { k?: unknown; i?: unknown };
  const keyIsValid =
    typeof k === 'string' ||
    (Array.isArray(k) && k.every((part) => typeof part === 'string'));

  if (!keyIsValid || typeof i !== 'string') {
    throw new ValidationError('Invalid pagination cursor');
  }

  return { sortKey: k as string | string[], id: i };
}

export function toCursorSortKey(value: string | number | Date): string {
  if (value instanceof Date) {
    // Schema columns are `timestamp` without time zone; node-pg reads them as
    // local-time Dates, so the cursor must be built from local components —
    // toISOString() would shift the value by the server timezone and break
    // keyset comparisons at page boundaries.
    const pad = (input: number, width = 2) => String(input).padStart(width, '0');

    return (
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
      `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}` +
      `.${pad(value.getMilliseconds(), 3)}`
    );
  }

  return String(value);
}

export function applyCursorPagination(
  params: PaginationParams,
  order: CursorOrderSpec
): CursorPaginationPlan {
  const limit = Math.max(1, params.limit ?? 25);

  if (params.cursor === undefined) {
    return {
      keyset: null,
      orderBy: null,
      fetchLimit: limit,
      offset: params.offset ?? 0,
    };
  }

  return {
    keyset:
      params.cursor === FIRST_PAGE_CURSOR
        ? null
        : keysetPredicate(order, decodeCursor(params.cursor)),
    orderBy: stableOrderBy(order),
    fetchLimit: limit + 1,
    offset: null,
  };
}

export function buildCursorPage<T>(
  fetchedRows: T[],
  params: PaginationParams,
  accessors: {
    sortKey: (row: T) => string | number | Date | readonly string[];
    id: (row: T) => string;
  },
  total?: number
): CursorPage<T> {
  const limit = Math.max(1, params.limit ?? 25);

  if (params.cursor !== undefined) {
    const hasMore = fetchedRows.length > limit;
    const data = hasMore ? fetchedRows.slice(0, limit) : fetchedRows;

    return {
      data,
      hasMore,
      ...nextCursorFor(data, hasMore, accessors),
    };
  }

  const offset = params.offset ?? 0;
  const hasMore = total !== undefined && offset + fetchedRows.length < total;

  return {
    data: fetchedRows,
    hasMore,
    ...nextCursorFor(fetchedRows, hasMore, accessors),
    meta: {
      ...(total !== undefined ? { total } : {}),
      limit,
      offset,
    },
  };
}

// Uniform-direction row comparison: (a, b) < (x, y) for DESC orders and
// (a, b) > (x, y) for ASC orders. Cursor values are always bound parameters;
// the column list is a per-resource constant.
function keysetPredicate(
  order: CursorOrderSpec,
  decoded: { sortKey: string | string[]; id: string }
): SQL {
  const keyValues = Array.isArray(decoded.sortKey)
    ? decoded.sortKey
    : [decoded.sortKey];

  if (keyValues.length !== order.columns.length - 1) {
    throw new ValidationError('Invalid pagination cursor');
  }

  const comparison = order.direction === 'asc' ? sql`>` : sql`<`;
  const columns = sql.raw(`(${order.columns.join(', ')})`);
  const values = sql.join(
    [...keyValues, decoded.id].map((value) => sql`${value}`),
    sql`, `
  );

  return sql`${columns} ${comparison} (${values})`;
}

function stableOrderBy(order: CursorOrderSpec): SQL {
  return sql.join(
    order.columns.map((column) => sql.raw(`${column} ${order.direction}`)),
    sql`, `
  );
}

function nextCursorFor<T>(
  data: T[],
  hasMore: boolean,
  accessors: {
    sortKey: (row: T) => string | number | Date | readonly string[];
    id: (row: T) => string;
  }
): { nextCursor?: string } {
  const last = data[data.length - 1];

  if (!hasMore || !last) {
    return {};
  }

  const sortKey = accessors.sortKey(last);

  return {
    nextCursor: encodeCursor(
      Array.isArray(sortKey) ? sortKey : toCursorSortKey(sortKey),
      accessors.id(last)
    ),
  };
}
