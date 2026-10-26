import { loginBodySchema } from '@edunic/source/domain/auth';
import { buildOpenApiDocument } from '../../src/docs/openapi.js';

// NFR-05: the served OpenAPI document describes the single-school routes. It is
// a plain object, so it is checked here without a database or a server.
type Operation = {
  requestBody?: {
    content: { 'application/json': { schema: Record<string, any> } };
  };
  responses: Record<string, any>;
};
type Doc = {
  openapi: string;
  tags: { name: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas?: Record<string, unknown>;
    responses: Record<string, unknown>;
  };
};

const doc = buildOpenApiDocument() as unknown as Doc;
const text = JSON.stringify(doc);

function operation(path: string, method: string): Operation {
  const found = doc.paths[path]?.[method];
  if (!found) {
    throw new Error(`${method.toUpperCase()} ${path} is not documented`);
  }
  return found;
}

describe('OpenAPI document (single school)', () => {
  it('is a JSON-serialisable OpenAPI 3 document whose $refs all resolve', () => {
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(doc)));
    expect(doc.openapi).toMatch(/^3\.0\./);

    const refs = [...text.matchAll(/"\$ref":"#\/components\/(\w+)\/(\w+)"/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const [, section, name] of refs) {
      expect(
        (doc.components as Record<string, Record<string, unknown>>)[section]?.[
          name
        ]
      ).toBeDefined();
    }
  });

  it('has no school identifier anywhere', () => {
    expect(text).not.toContain('institutionId');
  });

  it('documents no /institutions paths, tag or institution error responses', () => {
    expect(Object.keys(doc.paths).filter((p) => p.startsWith('/institutions')))
      .toEqual([]);
    expect(doc.tags.map((tag) => tag.name)).not.toContain('Institutions');
    expect(Object.keys(doc.components.responses)).not.toEqual(
      expect.arrayContaining(['InstitutionNotFound'])
    );
    expect(Object.keys(doc.components.responses)).not.toContain(
      'InstitutionConflict'
    );
    expect(doc.paths['/school-profile']).toBeDefined();
  });

  it('documents the global feature flag contract', () => {
    const patch = operation('/feature-flags/{featureKey}', 'patch');
    const body = patch.requestBody?.content['application/json'].schema;

    expect(body?.required).toEqual(['enabled']);
    expect(Object.keys(body?.properties)).toEqual(['enabled']);
    expect(Object.keys(patch.responses).sort()).toEqual(
      ['200', '400', '401', '403', '404']
    );
    expect(
      patch.responses['200'].content['application/json'].schema.properties.data
        .properties
    ).toEqual({
      key: expect.any(Object),
      enabled: expect.any(Object),
    });
    expect(
      Object.keys(doc.paths['/feature-flags/{featureKey}']).sort()
    ).toEqual(['patch']);

    const list = operation('/feature-flags', 'get').responses['200'].content[
      'application/json'
    ].schema.properties.data.items;
    expect(list.required).toEqual(['key', 'enabled']);
    expect(Object.keys(list.properties)).toEqual(['key', 'enabled']);
  });

  it('documents the global extension contract', () => {
    expect(Object.keys(doc.paths['/extensions']).sort()).toEqual(['get', 'post']);
    expect(Object.keys(doc.paths['/extensions/{extensionKey}'])).toEqual([
      'patch',
    ]);
    expect(Object.keys(doc.paths['/extensions/{extensionKey}/config']).sort())
      .toEqual(['delete', 'put']);

    const item = operation('/extensions', 'get').responses['200'].content[
      'application/json'
    ].schema.properties.data.items;
    expect(item.properties.config).toMatchObject({ nullable: true });

    const put = operation('/extensions/{extensionKey}/config', 'put');
    expect(
      put.requestBody?.content['application/json'].schema.properties.config
    ).toBeDefined();
  });

  it('documents the login body exactly as the route validates it', () => {
    const login = operation('/auth/login', 'post');
    const schema = login.requestBody?.content['application/json'].schema;
    const routeKeys = Object.keys(loginBodySchema.shape).sort();

    expect(Object.keys(schema?.properties).sort()).toEqual(routeKeys);
    expect([...schema?.required].sort()).toEqual(routeKeys);
    expect(JSON.stringify(login)).not.toMatch(/user_institution_roles/);
    expect(login.responses['200'].content['application/json'].schema).not
      .toHaveProperty('properties.data.properties.user.properties.institutionId');
  });

  // Read scoping (#64, #71, #76): a teacher or a parent outside the record's
  // scope is refused, so each of these reads documents the 403.
  it.each([
    ['/students', 'get'],
    ['/students/{studentId}', 'get'],
    ['/students/{studentId}/guardians', 'get'],
    ['/guardians', 'get'],
    ['/guardians/{guardianId}', 'get'],
    ['/enrollments', 'get'],
    ['/enrollments/{enrollmentId}', 'get'],
    ['/academic-averages/students/{studentId}', 'get'],
    ['/reports/students/{studentId}/academic-summary', 'get'],
    ['/reports/students/{studentId}/academic-summary/pdf', 'get'],
    ['/grades', 'get'],
    ['/grades/{gradeId}', 'get'],
    ['/attendance', 'get'],
    ['/attendance/{attendanceId}', 'get'],
  ])('%s %s documents 403', (path, method) => {
    expect(operation(path, method).responses['403']).toBeDefined();
  });
});

describe('OpenAPI document (attendance conflicts)', () => {
  // UNIQUE (enrollment_id, date): a second mark of the same day is a 409.
  it.each([
    ['/attendance', 'post'],
    ['/attendance/{attendanceId}', 'patch'],
  ])('%s %s documents the AttendanceConflict 409', (path, method) => {
    expect(operation(path, method).responses['409']).toEqual({
      $ref: '#/components/responses/AttendanceConflict',
    });
  });
});
