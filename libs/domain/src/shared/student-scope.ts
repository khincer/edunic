import { sql, type SQL } from 'drizzle-orm';

// Restricts a list to an explicit set of student ids. `undefined` means the
// list is unscoped (the administration). An empty set matches nothing, so an
// actor with no readable students gets an empty page, not everything.
//
// `column` is a constant literal chosen by the repository, never user input.
export function buildStudentIdCondition(
  column: string,
  studentIds: string[] | undefined
): SQL | null {
  if (studentIds === undefined) {
    return null;
  }

  if (studentIds.length === 0) {
    return sql`false`;
  }

  return sql`${sql.raw(column)} in (${sql.join(
    studentIds.map((id) => sql`${id}`),
    sql`, `
  )})`;
}
