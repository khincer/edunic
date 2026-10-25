import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Guard for the single-school sweep (TEN-05, TEN-07, AUTH-05). A path is a
// file or a directory (scanned recursively).
const REPO_ROOT = join(__dirname, '../../../..');

// S1.4h: the guard is repo-wide for runtime code. Every module is swept, so
// the roots below are scanned whole instead of listing modules one by one.
const SWEPT: string[] = [
  'apps/edunic-api/src',
  'libs/domain/src',
  'libs/events/src',
  'apps/edunic-worker/src',
  'apps/edunic-fe/src',
];

// Deliberately NOT scanned:
//  - libs/db (Drizzle schema + migrations keep the columns until 0015, S1.8b),
//    tools/ (seed, S1.7) and every test directory (fixtures, S1.8a) are outside
//    the roots above;
//  - the OpenAPI document is brought in line with the routes in S1.4h-2.
const EXCLUDED: string[] = ['apps/edunic-api/src/docs/openapi.ts'];

// The pattern targets the tenant identifier, never the `institutions` table:
// the school profile and the single-school context lookups legitimately read
// `from institutions` (the one configuration row), and none of these tokens
// appear in them. Also the per-school tables, which stay in the DB only until
// 0015, the removed request header, and the removed per-user tenant tables.
const FORBIDDEN =
  /institutionId|institution_id|getInstitutionId|InstitutionNotResolvedError|x-institution-id|user_institution_roles|institution_feature_flags|institutionFeatureFlags|institution_extensions|institutionExtensions/;

function listFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path];
  }

  return readdirSync(path).flatMap((entry) => listFiles(join(path, entry)));
}

describe('single-school sweep guard', () => {
  const excluded = EXCLUDED.map((path) => join(REPO_ROOT, path));
  const files = SWEPT.flatMap((path) =>
    listFiles(join(REPO_ROOT, path))
  ).filter((file) => /\.(ts|tsx|css|mjs|json)$/.test(file) && !excluded.includes(file));

  it('scans real files across every runtime root', () => {
    const relativeFiles = files.map((file) =>
      relative(REPO_ROOT, file).split(sep).join('/')
    );

    expect(files.length).toBeGreaterThanOrEqual(150);
    for (const root of SWEPT) {
      expect(
        relativeFiles.filter((file) => file.startsWith(`${root}/`)).length
      ).toBeGreaterThan(0);
    }
  });

  // AUTH-05: the helper is gone from the whole API workspace, tests included.
  // This file is skipped: it names the helper to look for.
  it('has no getInstitutionId anywhere in the API src or test trees', () => {
    const helper = ['get', 'InstitutionId'].join('');
    const offending = ['apps/edunic-api/src', 'apps/edunic-api/test']
      .flatMap((path) => listFiles(join(REPO_ROOT, path)))
      .filter((file) => file.endsWith('.ts') && file !== __filename)
      .filter((file) => readFileSync(file, 'utf8').includes(helper))
      .map((file) => relative(REPO_ROOT, file));

    expect(offending).toEqual([]);
  });

  it('only excludes files that still exist', () => {
    for (const file of excluded) {
      expect(statSync(file).isFile()).toBe(true);
    }
  });

  it.each(files.map((file) => [relative(REPO_ROOT, file), file]))(
    '%s has no institution reference',
    (_name, file) => {
      const offending = readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => FORBIDDEN.test(line))
        .map(({ line, number }) => `${number}: ${line.trim()}`);

      expect(offending).toEqual([]);
    }
  );
});
