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
  'tools',
  // S1.8b: migration 0015 dropped the columns, so the Drizzle schema and the
  // db helpers carry no tenant identifier either.
  'libs/db/src/schema',
  'libs/db/src/index.ts',
  'libs/db/src/create-db.ts',
];

// Deliberately NOT scanned:
//  - libs/db/src/migrations: the SQL history names the column it drops.
//  - the test directories, guarded by the second describe block below.
//    Nothing inside the roots is excluded. tools/ (seed, create-user,
//    reset-db) is scanned since S1.7.

// The pattern targets the tenant identifier, never the `institutions` table:
// the school profile and the single-school context lookups legitimately read
// `from institutions` (the one configuration row), and none of these tokens
// appear in them. Also the per-school tables dropped by 0015, the removed
// request header, and the removed per-user tenant tables.
const FORBIDDEN =
  /institutionId|institution_id|getInstitutionId|InstitutionNotResolvedError|x-institution-id|user_institution_roles|institution_feature_flags|institutionFeatureFlags|institution_extensions|institutionExtensions/;

function listFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path];
  }

  return readdirSync(path).flatMap((entry) => listFiles(join(path, entry)));
}

describe('single-school sweep guard', () => {
  const files = SWEPT.flatMap((path) =>
    listFiles(join(REPO_ROOT, path))
  ).filter((file) => /\.(ts|tsx|css|mjs|json)$/.test(file));

  it('scans real files across every runtime root', () => {
    const relativeFiles = files.map((file) =>
      relative(REPO_ROOT, file).split(sep).join('/')
    );

    expect(files.length).toBeGreaterThanOrEqual(150);
    for (const root of SWEPT) {
      expect(
        relativeFiles.filter(
          (file) => file === root || file.startsWith(`${root}/`)
        ).length
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

  it('scans the OpenAPI document like every other runtime file', () => {
    expect(
      files.map((file) => relative(REPO_ROOT, file).split(sep).join('/'))
    ).toContain('apps/edunic-api/src/docs/openapi.ts');
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

// S1.8a: the API test tree stops passing, inserting or asserting the tenant
// identifier, so migration 0015 (S1.8b) could drop the columns without touching
// the suite.
const TEST_ROOT = 'apps/edunic-api/test';

// Specs whose subject IS the database itself: the institution_id columns, the
// 0014 default, the 0015 contract, the institutions table or the seed. They
// name the dropped column on purpose (to prove it is gone, or to replay the
// migrations that still had it), so they are excluded permanently.
const TEST_EXCLUDED: RegExp[] = [
  /^integration\/migration-[^/]+\.spec\.ts$/,
  /^integration\/db-constraints\.spec\.ts$/,
  /^integration\/seed-single-school\.spec\.ts$/,
  /^integration\/single-school-request-context\.spec\.ts$/,
  /^integration\/dashboards-school-context\.spec\.ts$/,
  /^unit\/single-school-sweep\.spec\.ts$/,
  // Legacy-payload tolerance: events and idempotency scopes queued by an
  // instance that still sends the school must keep being accepted (rolling
  // deploy), so these specs name the field on purpose.
  /^unit\/(event-bus|email-delivery\.service|notifications\.service|idempotency)\.spec\.ts$/,
];

// An assertion that a value does NOT carry the field proves the contract is
// free of the school, so it is allowed (it survives the column drop).
const ABSENCE_ASSERTION =
  /not\s*\.(toHaveProperty|toContain|toMatch)\(\s*(?:'[\w.]*'|\/[\w|.]*\/)\s*\)/g;

// Files not yet cleaned. Empty since S1.8a part 2: nothing may be added back.
const TEST_PENDING: string[] = [];

describe('single-school sweep guard (API test tree)', () => {
  const testFiles = listFiles(join(REPO_ROOT, TEST_ROOT))
    .filter((file) => /\.ts$/.test(file))
    .map((file) => ({
      file,
      name: relative(join(REPO_ROOT, TEST_ROOT), file).split(sep).join('/'),
    }));

  const isExcluded = (name: string) =>
    TEST_EXCLUDED.some((pattern) => pattern.test(name));

  const offendingLines = (file: string) =>
    readFileSync(file, 'utf8')
      .replace(ABSENCE_ASSERTION, (match) => match.replace(/[^\n]/g, ''))
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => FORBIDDEN.test(line))
      .map(({ line, number }) => `${number}: ${line.trim()}`);

  it('scans helpers, unit, integration and e2e files', () => {
    for (const dir of ['helpers/', 'unit/', 'integration/', 'e2e/']) {
      expect(
        testFiles.filter(({ name }) => name.startsWith(dir)).length
      ).toBeGreaterThan(0);
    }
  });

  it('only lists existing files in the exclusion and pending lists', () => {
    const names = testFiles.map(({ name }) => name);

    expect(TEST_PENDING.filter((name) => !names.includes(name))).toEqual([]);
    expect(
      TEST_EXCLUDED.filter((pattern) => !names.some((n) => pattern.test(n)))
    ).toEqual([]);
  });

  it('has no pending file left', () => {
    expect(TEST_PENDING).toEqual([]);
  });

  it.each(
    testFiles
      .filter(({ name }) => !isExcluded(name) && !TEST_PENDING.includes(name))
      .map(({ name, file }) => [name, file])
  )('%s has no institution reference', (_name, file) => {
    expect(offendingLines(file)).toEqual([]);
  });
});
