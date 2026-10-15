import { sql, type SQL } from 'drizzle-orm';
import { ValidationError } from '../app-error.js';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in';

export type FilterValue = string | number | boolean | Array<string | number>;

export interface FilterSpec {
  field: string;
  operator: FilterOperator;
  value: FilterValue;
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterSortOptions {
  /** Whitelisted filterable field names for the resource. */
  filterFields: readonly string[];
  /** Whitelisted sortable field names for the resource. */
  sortFields: readonly string[];
}

export interface ParsedFilterSort {
  filters: FilterSpec[];
  sort: SortSpec | null;
}

const FILTER_OPERATORS: readonly FilterOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'in',
];

/**
 * Parses the uniform list conventions:
 * - `filter=field:operator:value` (repeatable; value may contain colons)
 * - `sort=field:direction`
 * Fields outside the resource whitelist are rejected, so identifiers never
 * reach SQL construction from user input.
 */
export function parseFilterSort(
  query: { filter?: string | string[]; sort?: string },
  options: FilterSortOptions
): ParsedFilterSort {
  return {
    filters: parseFilters(query.filter, options.filterFields),
    sort: parseSort(query.sort, options.sortFields),
  };
}

export function buildFilterConditions(
  filters: FilterSpec[],
  columnMap: Readonly<Record<string, string>>
): SQL[] {
  return filters.map((filter) => buildFilterCondition(filter, columnMap));
}

export function buildSortSql(
  sort: SortSpec | null,
  columnMap: Readonly<Record<string, string>>
): SQL | null {
  if (!sort) {
    return null;
  }

  const column = resolveColumn(sort.field, columnMap);
  const direction = sort.direction === 'asc' ? sql.raw('asc') : sql.raw('desc');

  return sql`${column} ${direction}`;
}

function parseFilters(
  raw: string | string[] | undefined,
  allowedFields: readonly string[]
): FilterSpec[] {
  if (raw === undefined) {
    return [];
  }

  const entries = Array.isArray(raw) ? raw : [raw];
  return entries.map((entry) => parseFilter(entry, allowedFields));
}

function parseFilter(
  entry: string,
  allowedFields: readonly string[]
): FilterSpec {
  const fieldSeparator = entry.indexOf(':');
  const field = fieldSeparator > 0 ? entry.slice(0, fieldSeparator) : '';
  const remainder = fieldSeparator > 0 ? entry.slice(fieldSeparator + 1) : '';

  const operatorSeparator = remainder.indexOf(':');
  const operator =
    operatorSeparator > 0 ? remainder.slice(0, operatorSeparator) : '';
  const value = operatorSeparator > 0 ? remainder.slice(operatorSeparator + 1) : '';

  if (!allowedFields.includes(field)) {
    throw new ValidationError(`Unsupported filter field: ${field || entry}`);
  }

  if (!isFilterOperator(operator)) {
    throw new ValidationError(
      `Unsupported filter operator: ${operator || entry}`
    );
  }

  if (value === '') {
    throw new ValidationError(`Filter value is required: ${entry}`);
  }

  return { field, operator, value: parseFilterValue(operator, value) };
}

function parseFilterValue(operator: FilterOperator, value: string): FilterValue {
  if (operator !== 'in') {
    return value;
  }

  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new ValidationError('Filter value list cannot be empty');
  }

  return values;
}

function parseSort(
  raw: string | undefined,
  allowedFields: readonly string[]
): SortSpec | null {
  if (raw === undefined || raw === '') {
    return null;
  }

  const [field, direction] = raw.split(':');

  if (
    !allowedFields.includes(field) ||
    (direction !== 'asc' && direction !== 'desc')
  ) {
    throw new ValidationError(`Invalid sort: ${raw}`);
  }

  return { field, direction };
}

function isFilterOperator(value: string): value is FilterOperator {
  return (FILTER_OPERATORS as readonly string[]).includes(value);
}

// Column identifiers come from per-resource constant maps (never user input);
// user values always travel as bound parameters.
function resolveColumn(
  field: string,
  columnMap: Readonly<Record<string, string>>
): SQL {
  const column = columnMap[field];

  if (!column) {
    throw new ValidationError(`Unsupported filter field: ${field}`);
  }

  return sql.raw(column);
}

function buildFilterCondition(
  filter: FilterSpec,
  columnMap: Readonly<Record<string, string>>
): SQL {
  const column = resolveColumn(filter.field, columnMap);

  switch (filter.operator) {
    case 'eq':
      return sql`${column} = ${scalarParam(filter.value)}`;
    case 'neq':
      return sql`${column} <> ${scalarParam(filter.value)}`;
    case 'gt':
      return sql`${column} > ${scalarParam(filter.value)}`;
    case 'gte':
      return sql`${column} >= ${scalarParam(filter.value)}`;
    case 'lt':
      return sql`${column} < ${scalarParam(filter.value)}`;
    case 'lte':
      return sql`${column} <= ${scalarParam(filter.value)}`;
    case 'contains':
      return sql`${column} ilike ${`%${String(filter.value)}%`}`;
    case 'in': {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];

      if (values.length === 0) {
        throw new ValidationError('Filter value list cannot be empty');
      }

      return sql`${column} in (${sql.join(
        values.map((value) => sql`${value}`),
        sql`, `
      )})`;
    }
  }
}

function scalarParam(value: FilterValue): string | number | boolean {
  return Array.isArray(value) ? String(value[0] ?? '') : value;
}
