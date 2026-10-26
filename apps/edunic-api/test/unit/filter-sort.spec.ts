import { PgDialect } from 'drizzle-orm/pg-core';
import {
  ValidationError,
  parseFilterSort,
  buildFilterConditions,
  buildSortSql,
} from '@edunic/source/domain/shared';

const OPTIONS = {
  filterFields: ['firstName', 'lastName', 'dateOfBirth', 'createdAt'] as const,
  sortFields: ['firstName', 'lastName', 'createdAt'] as const,
};

const STUDENT_COLUMNS = {
  firstName: 'first_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  createdAt: 'created_at',
} as const;

describe('parseFilterSort', () => {
  it('parses filter and sort params into structured specs', () => {
    const parsed = parseFilterSort(
      { filter: 'firstName:eq:Ana', sort: 'lastName:asc' },
      OPTIONS
    );

    expect(parsed).toEqual({
      filters: [{ field: 'firstName', operator: 'eq', value: 'Ana' }],
      sort: { field: 'lastName', direction: 'asc' },
    });
  });

  it('accepts repeated filters and preserves colons in values', () => {
    const parsed = parseFilterSort(
      {
        filter: [
          'createdAt:gte:2026-01-01T00:00:00',
          'lastName:contains:a:b',
        ],
      },
      OPTIONS
    );

    expect(parsed.filters).toEqual([
      { field: 'createdAt', operator: 'gte', value: '2026-01-01T00:00:00' },
      { field: 'lastName', operator: 'contains', value: 'a:b' },
    ]);
  });

  it('splits comma-separated values for the in operator', () => {
    const parsed = parseFilterSort({ filter: 'firstName:in:Ana,Bea' }, OPTIONS);

    expect(parsed.filters).toEqual([
      { field: 'firstName', operator: 'in', value: ['Ana', 'Bea'] },
    ]);
  });

  it('rejects fields outside the whitelist', () => {
    expect(() =>
      parseFilterSort({ filter: 'password:eq:secret' }, OPTIONS)
    ).toThrow(ValidationError);
    expect(() => parseFilterSort({ sort: 'password:asc' }, OPTIONS)).toThrow(
      ValidationError
    );
  });

  it('rejects unknown operators and sort directions', () => {
    expect(() => parseFilterSort({ filter: 'firstName:regex:.*' }, OPTIONS)).toThrow(
      ValidationError
    );
    expect(() => parseFilterSort({ sort: 'lastName:sideways' }, OPTIONS)).toThrow(
      ValidationError
    );
  });

  it('rejects malformed filter entries', () => {
    expect(() => parseFilterSort({ filter: 'firstName' }, OPTIONS)).toThrow(
      ValidationError
    );
    expect(() => parseFilterSort({ filter: 'firstName:eq:' }, OPTIONS)).toThrow(
      ValidationError
    );
    expect(() => parseFilterSort({ filter: ':eq:x' }, OPTIONS)).toThrow(
      ValidationError
    );
  });

  it('returns an empty result when no params are present', () => {
    expect(parseFilterSort({}, OPTIONS)).toEqual({ filters: [], sort: null });
  });
});

describe('buildFilterConditions', () => {
  it('produces parameterized SQL for equality filters', () => {
    const maliciousValue = "O'Neil' OR 1=1--";

    const [condition] = buildFilterConditions(
      [{ field: 'firstName', operator: 'eq', value: maliciousValue }],
      STUDENT_COLUMNS
    );

    const query = new PgDialect().sqlToQuery(condition);
    expect(query.sql).toBe('first_name = $1');
    // The value only ever reaches the query as a bound parameter.
    expect(query.params).toEqual([maliciousValue]);
  });

  it('parameterizes contains and in operators', () => {
    const [contains] = buildFilterConditions(
      [{ field: 'lastName', operator: 'contains', value: "x'); drop table students;--" }],
      STUDENT_COLUMNS
    );
    const containsQuery = new PgDialect().sqlToQuery(contains);
    expect(containsQuery.sql).toBe('last_name ilike $1');
    expect(containsQuery.params).toEqual([
      "%x'); drop table students;--%",
    ]);

    const [inCondition] = buildFilterConditions(
      [{ field: 'firstName', operator: 'in', value: ['Ana', 'Bea'] }],
      STUDENT_COLUMNS
    );
    const inQuery = new PgDialect().sqlToQuery(inCondition);
    expect(inQuery.sql).toBe('first_name in ($1, $2)');
    expect(inQuery.params).toEqual(['Ana', 'Bea']);
  });

  it('supports comparison operators', () => {
    const conditions = buildFilterConditions(
      [
        { field: 'dateOfBirth', operator: 'gte', value: '2015-01-01' },
        { field: 'dateOfBirth', operator: 'lt', value: '2018-01-01' },
      ],
      STUDENT_COLUMNS
    );

    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(conditions[0]).sql).toBe('date_of_birth >= $1');
    expect(dialect.sqlToQuery(conditions[1]).sql).toBe('date_of_birth < $1');
  });

  it('refuses fields missing from the column map', () => {
    expect(() =>
      buildFilterConditions(
        [{ field: 'evil', operator: 'eq', value: '1' }],
        STUDENT_COLUMNS
      )
    ).toThrow(ValidationError);
  });
});

describe('buildSortSql', () => {
  it('maps whitelisted fields to direction-qualified columns', () => {
    const sortSql = buildSortSql(
      { field: 'lastName', direction: 'asc' },
      STUDENT_COLUMNS
    );

    expect(new PgDialect().sqlToQuery(sortSql as never).sql).toBe(
      'last_name asc'
    );
  });

  it('returns null without a sort and rejects unknown fields', () => {
    expect(buildSortSql(null, STUDENT_COLUMNS)).toBeNull();
    expect(() =>
      buildSortSql({ field: 'nope', direction: 'asc' }, STUDENT_COLUMNS)
    ).toThrow(ValidationError);
  });
});
