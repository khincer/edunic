import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  ValidationError,
  encodeCursor,
  decodeCursor,
  toCursorSortKey,
  applyCursorPagination,
  buildCursorPage,
  type CursorOrderSpec,
} from '@edunic/source/domain/shared';

const CREATED_AT_DESC: CursorOrderSpec = {
  columns: ['e.created_at', 'e.id'],
  direction: 'desc',
};

const STUDENT_NAME_ASC: CursorOrderSpec = {
  columns: ['last_name', 'first_name', 'id'],
  direction: 'asc',
};

const ACCESSORS = {
  sortKey: (row: StudentRow) => [row.lastName, row.firstName],
  id: (row: StudentRow) => row.id,
};

type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
};

function toQuery(value: SQL) {
  return new PgDialect().sqlToQuery(value);
}

function createRows(count: number): StudentRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `student-${index + 1}`,
    firstName: `First${index + 1}`,
    lastName: 'Lopez',
    createdAt: new Date(2026, 0, 1 + index, 12, 30, 0, 0),
  }));
}

describe('cursor encoding', () => {
  it('round-trips a single sort key and id', () => {
    const cursor = encodeCursor('2026-01-02T03:04:05.006', 'row-1');

    expect(decodeCursor(cursor)).toEqual({
      sortKey: '2026-01-02T03:04:05.006',
      id: 'row-1',
    });
  });

  it('round-trips a composite sort key', () => {
    const cursor = encodeCursor(['Lopez', 'Ana'], 'row-2');

    expect(decodeCursor(cursor)).toEqual({
      sortKey: ['Lopez', 'Ana'],
      id: 'row-2',
    });
  });

  it('rejects malformed cursors with a 400 error', () => {
    const invalidCursors = [
      '',
      'not-base64!!',
      Buffer.from('{"k":1,"i":"x"}').toString('base64'),
      Buffer.from('{"k":"x"}').toString('base64'),
      Buffer.from('"just-a-string"').toString('base64'),
    ];

    for (const cursor of invalidCursors) {
      let thrown: unknown;
      try {
        decodeCursor(cursor);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ValidationError);
      expect((thrown as ValidationError).statusCode).toBe(400);
    }
  });
});

describe('toCursorSortKey', () => {
  it('formats dates from local components so timestamp-without-tz columns round-trip', () => {
    const value = new Date(2026, 0, 2, 3, 4, 5, 6);

    expect(toCursorSortKey(value)).toBe('2026-01-02T03:04:05.006');
  });

  it('passes strings through and stringifies numbers', () => {
    expect(toCursorSortKey('Lopez')).toBe('Lopez');
    expect(toCursorSortKey(42)).toBe('42');
  });
});

describe('applyCursorPagination', () => {
  it('keeps the legacy offset path when no cursor is given', () => {
    const plan = applyCursorPagination({ limit: 10, offset: 20 }, CREATED_AT_DESC);

    expect(plan.keyset).toBeNull();
    expect(plan.orderBy).toBeNull();
    expect(plan.fetchLimit).toBe(10);
    expect(plan.offset).toBe(20);
  });

  it('supports the start sentinel for first-page keyset requests', () => {
    const plan = applyCursorPagination({ cursor: 'start', limit: 10 }, CREATED_AT_DESC);

    // No keyset predicate yet, but stable order and sentinel limit apply.
    expect(plan.keyset).toBeNull();
    expect(toQuery(plan.orderBy as SQL).sql).toBe(
      'e.created_at desc, e.id desc'
    );
    expect(plan.fetchLimit).toBe(11);
    expect(plan.offset).toBeNull();
  });

  it('builds a descending keyset predicate with parameterized values', () => {
    const cursor = encodeCursor('2026-01-02T03:04:05.006', 'row-1');

    const plan = applyCursorPagination({ cursor, limit: 10 }, CREATED_AT_DESC);

    expect(plan.offset).toBeNull();
    // One extra row is fetched to detect whether another page exists.
    expect(plan.fetchLimit).toBe(11);

    const query = toQuery(plan.keyset as SQL);
    expect(query.sql).toBe('(e.created_at, e.id) < ($1, $2)');
    expect(query.params).toEqual(['2026-01-02T03:04:05.006', 'row-1']);
  });

  it('builds an ascending composite keyset for multi-column orders', () => {
    const cursor = encodeCursor(['Lopez', 'Ana'], 'row-2');

    const plan = applyCursorPagination({ cursor, limit: 5 }, STUDENT_NAME_ASC);

    const query = toQuery(plan.keyset as SQL);
    expect(query.sql).toBe('(last_name, first_name, id) > ($1, $2, $3)');
    expect(query.params).toEqual(['Lopez', 'Ana', 'row-2']);
  });

  it('produces the stable order-by for cursor mode', () => {
    const cursor = encodeCursor('k', 'id-1');

    const plan = applyCursorPagination({ cursor, limit: 5 }, CREATED_AT_DESC);

    expect(toQuery(plan.orderBy as SQL).sql).toBe(
      'e.created_at desc, e.id desc'
    );
  });

  it('rejects cursors whose key count does not match the stable order', () => {
    const cursor = encodeCursor(['only-one'], 'row-3');

    expect(() =>
      applyCursorPagination({ cursor, limit: 5 }, STUDENT_NAME_ASC)
    ).toThrow(ValidationError);
  });
});

describe('buildCursorPage', () => {
  const rows = createRows(5);

  it('slices the sentinel row and exposes the next cursor in cursor mode', () => {
    const fetched = rows.slice(0, 3); // limit 2 + sentinel row

    const page = buildCursorPage(fetched, { cursor: 'c', limit: 2 }, ACCESSORS);

    expect(page.data.map((row) => row.id)).toEqual(['student-1', 'student-2']);
    expect(page.hasMore).toBe(true);
    expect(decodeCursor(page.nextCursor as string)).toEqual({
      sortKey: ['Lopez', 'First2'],
      id: 'student-2',
    });
  });

  it('treats the start sentinel as cursor mode for page assembly', () => {
    const fetched = rows.slice(0, 3); // limit 2 + sentinel row

    const page = buildCursorPage(
      fetched,
      { cursor: 'start', limit: 2 },
      ACCESSORS
    );

    expect(page.data.map((row) => row.id)).toEqual(['student-1', 'student-2']);
    expect(page.hasMore).toBe(true);
    expect(page.meta).toBeUndefined();
  });

  it('reports the last page without a next cursor', () => {
    const fetched = rows.slice(0, 2);

    const page = buildCursorPage(fetched, { cursor: 'c', limit: 2 }, ACCESSORS);

    expect(page.data).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });

  it('keeps total and offset metadata in legacy mode', () => {
    const page = buildCursorPage(
      rows.slice(2, 4),
      { limit: 2, offset: 2 },
      ACCESSORS,
      5
    );

    expect(page.data.map((row) => row.id)).toEqual(['student-3', 'student-4']);
    expect(page.hasMore).toBe(true);
    expect(page.meta).toEqual({ total: 5, limit: 2, offset: 2 });
    expect(decodeCursor(page.nextCursor as string)).toEqual({
      sortKey: ['Lopez', 'First4'],
      id: 'student-4',
    });
  });

  it('reports exhausted legacy pages without a next cursor', () => {
    const page = buildCursorPage(
      rows.slice(2, 4),
      { limit: 2, offset: 2 },
      ACCESSORS,
      5
    );

    const lastPage = buildCursorPage(
      rows.slice(4),
      { limit: 2, offset: 4 },
      ACCESSORS,
      5
    );

    expect(page.hasMore).toBe(true);
    expect(lastPage.hasMore).toBe(false);
    expect(lastPage.nextCursor).toBeUndefined();
  });
});
