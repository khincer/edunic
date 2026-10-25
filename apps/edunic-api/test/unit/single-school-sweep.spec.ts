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
  // S1.4d-1: academic periods, classrooms and academic averages. Their
  // UNIQUE (institution_id, year, term) / (institution_id, grade_level,
  // section) keys keep the column until 0015: with one school they behave as
  // (year, term) / (grade_level, section) and the 409 checks stay in the app.
  'libs/domain/src/academic-periods',
  'apps/edunic-api/src/routes/academic-periods.routes.ts',
  'libs/domain/src/classrooms',
  'apps/edunic-api/src/routes/classrooms.routes.ts',
  'libs/domain/src/academic-averages',
  'apps/edunic-api/src/routes/academic-averages.routes.ts',
  // S1.4d-2: custom fields and audit logs. custom_fields has no unique key
  // that includes institution_id, so there is no duplicate check to keep.
  // plugins/audit-logs.plugin.ts is NOT listed: resolveEntityId still reads
  // the `:institutionId` route param of the institutions routes (S1.4h).
  'libs/domain/src/custom-fields',
  'apps/edunic-api/src/routes/custom-fields.routes.ts',
  'libs/domain/src/audit-logs',
  'apps/edunic-api/src/routes/audit-logs.routes.ts',
  // S1.4e-1: students and guardians. student_guardians has no institution
  // column (PK (student_id, guardian_id)); guardian_user_links keeps its
  // (institution_id, guardian_id, user_id) PK until 0015 and is written by
  // other modules, not these.
  'libs/domain/src/students',
  'apps/edunic-api/src/routes/students.routes.ts',
  'libs/domain/src/guardians',
  'apps/edunic-api/src/routes/guardians.routes.ts',
  // S1.4e-2: enrollments. UNIQUE (student_id, academic_period_id) never
  // included institution_id, so the 409 duplicate check is unchanged. The
  // enrollment.* events stop carrying institutionId (the optional field stays
  // on the event types until S1.4h).
  'libs/domain/src/enrollments',
  'apps/edunic-api/src/routes/enrollments.routes.ts',
  // S1.4f: attendance, grades and reports. UNIQUE (enrollment_id, date) on
  // attendance never included institution_id; grades has no unique key. The
  // grade.submitted / attendance.marked events stop carrying institutionId
  // (the optional field stays on the event types until S1.4h).
  'libs/domain/src/attendance',
  'apps/edunic-api/src/routes/attendance.routes.ts',
  'libs/domain/src/grades',
  'apps/edunic-api/src/routes/grades.routes.ts',
  'libs/domain/src/reports',
  'apps/edunic-api/src/routes/reports.routes.ts',
  // S1.4g-1: workflows (assignments, school events, messages). The tables keep
  // the column until 0015 (DEFAULT single_school_id()); no unique key or PK on
  // them includes institution_id. The responses stop carrying it.
  'libs/domain/src/workflows',
  'apps/edunic-api/src/routes/workflows.routes.ts',
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
