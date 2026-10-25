import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guard for the single-school sweep (TEN-05, AUTH-05). Each sweep slice adds
// the paths it cleans here first (RED), then removes the references (GREEN).
// A path is a file or a directory (scanned recursively).
const REPO_ROOT = join(__dirname, '../../../..');

const SWEPT: string[] = [
  // S1.4b-1: feature flags are global
  'libs/domain/src/feature-flags',
  'apps/edunic-api/src/routes/feature-flags.routes.ts',
  // S1.4b-2: extensions are global
  'libs/domain/src/extensions',
  'apps/edunic-api/src/routes/extensions.routes.ts',
  // S1.4c: notifications and email delivery. libs/domain/src/events.ts and
  // libs/events keep an OPTIONAL institutionId (events already queued still
  // carry it) until S1.4h, so they are deliberately not listed yet.
  'libs/domain/src/notifications',
  'apps/edunic-api/src/routes/notifications.routes.ts',
  'apps/edunic-worker/src/bootstrap.ts',
];

// Also the per-school tables, which stay in the DB only until 0015.
const FORBIDDEN =
  /institutionId|institution_id|getInstitutionId|institution_feature_flags|institutionFeatureFlags|institution_extensions|institutionExtensions/;

function listFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path];
  }

  return readdirSync(path).flatMap((entry) => listFiles(join(path, entry)));
}

describe('single-school sweep guard', () => {
  const files = SWEPT.flatMap((path) => listFiles(join(REPO_ROOT, path)));

  it('scans real files', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
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
