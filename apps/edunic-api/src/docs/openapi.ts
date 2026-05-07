const institutionIdHeaderSchema = {
  name: 'x-institution-id',
  in: 'header',
  required: true,
  description: 'Tenant identifier used to scope all student operations.',
  schema: {
    type: 'string',
    format: 'uuid',
    example: '00000000-0000-0000-0000-000000000001',
  },
};

const studentSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'firstName', 'lastName', 'fullName'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    firstName: { type: 'string', example: 'Jane' },
    lastName: { type: 'string', example: 'Doe' },
    fullName: { type: 'string', example: 'Jane Doe' },
    dateOfBirth: {
      type: 'string',
      nullable: true,
      example: '2012-03-15',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
  },
};

const institutionSchema = {
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Colegio Central' },
    createdAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
  },
};

const guardianSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Maria Lopez' },
    phone: {
      type: 'string',
      nullable: true,
      example: '+50255550000',
    },
  },
};

const auditLogSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'action', 'entity'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid', nullable: true },
    action: {
      type: 'string',
      enum: ['create', 'update', 'delete'],
      example: 'update',
    },
    entity: { type: 'string', example: 'students' },
    entityId: { type: 'string', format: 'uuid', nullable: true },
    before: { nullable: true },
    after: { nullable: true },
    createdAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
  },
};

const extensionSchema = {
  type: 'object',
  required: ['key', 'name', 'enabled'],
  properties: {
    key: { type: 'string', example: 'notifications' },
    name: { type: 'string', nullable: true, example: 'Notifications' },
    enabled: { type: 'boolean', example: true },
  },
};

const institutionExtensionSchema = {
  type: 'object',
  required: ['institutionId', 'extensionKey', 'config', 'extension'],
  properties: {
    institutionId: { type: 'string', format: 'uuid' },
    extensionKey: { type: 'string', example: 'notifications' },
    config: { type: 'object', additionalProperties: true },
    extension: extensionSchema,
  },
};

const customFieldSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'entity', 'name', 'type'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    entity: { type: 'string', example: 'students' },
    name: { type: 'string', example: 'Scholarship' },
    type: {
      type: 'string',
      enum: ['text', 'number', 'date', 'boolean', 'select'],
      example: 'boolean',
    },
  },
};

const customFieldValueSchema = {
  type: 'object',
  required: ['fieldId', 'entityId', 'value', 'field'],
  properties: {
    id: { type: 'string', format: 'uuid', nullable: true },
    fieldId: { type: 'string', format: 'uuid' },
    entityId: { type: 'string', format: 'uuid' },
    value: { nullable: true },
    field: {
      type: 'object',
      properties: {
        entity: { type: 'string', example: 'students' },
        name: { type: 'string', example: 'Scholarship' },
        type: {
          type: 'string',
          enum: ['text', 'number', 'date', 'boolean', 'select'],
        },
      },
    },
  },
};

const notificationSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'eventName', 'title', 'message'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    eventName: { type: 'string', example: 'grade.submitted' },
    title: { type: 'string', example: 'Grade submitted' },
    message: { type: 'string', example: 'Mathematics grade was submitted' },
    metadata: { nullable: true },
    readAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const enrollmentSchema = {
  type: 'object',
  required: [
    'id',
    'institutionId',
    'studentId',
    'academicPeriodId',
    'status',
    'student',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    studentId: { type: 'string', format: 'uuid' },
    academicPeriodId: { type: 'string', format: 'uuid' },
    classroomId: { type: 'string', format: 'uuid', nullable: true },
    status: {
      type: 'string',
      enum: ['active', 'withdrawn', 'completed'],
      example: 'active',
    },
    promotionStatus: {
      type: 'string',
      nullable: true,
      example: 'promoted',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    student: {
      type: 'object',
      required: ['id', 'firstName', 'lastName', 'fullName'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        firstName: { type: 'string', example: 'Jane' },
        lastName: { type: 'string', example: 'Doe' },
        fullName: { type: 'string', example: 'Jane Doe' },
      },
    },
  },
};

const gradeSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'enrollmentId', 'subject', 'score'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    enrollmentId: { type: 'string', format: 'uuid' },
    subject: { type: 'string', example: 'Mathematics' },
    score: { type: 'integer', minimum: 0, maximum: 100, example: 87 },
    createdAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
  },
};

const attendanceSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'enrollmentId', 'date', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    enrollmentId: { type: 'string', format: 'uuid' },
    date: { type: 'string', format: 'date-time' },
    status: {
      type: 'string',
      enum: ['present', 'absent', 'late'],
      example: 'present',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
  },
};

const academicPeriodSchema = {
  type: 'object',
  required: ['id', 'institutionId', 'year', 'term'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    institutionId: { type: 'string', format: 'uuid' },
    year: { type: 'integer', example: 2026 },
    term: { type: 'integer', minimum: 1, maximum: 4, example: 1 },
    startDate: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    endDate: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
  },
};

const academicAverageSchema = {
  type: 'object',
  required: ['institutionId', 'studentId', 'year', 'annualSubjects', 'termAverages'],
  properties: {
    institutionId: { type: 'string', format: 'uuid' },
    studentId: { type: 'string', format: 'uuid' },
    year: { type: 'integer', example: 2026 },
    annualAverage: {
      type: 'number',
      nullable: true,
      example: 89.67,
    },
    annualSubjects: {
      type: 'array',
      items: {
        type: 'object',
        required: ['subject', 'average'],
        properties: {
          subject: { type: 'string', example: 'Mathematics' },
          average: { type: 'number', nullable: true, example: 88.5 },
        },
      },
    },
    termAverages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['academicPeriodId', 'term', 'subjects'],
        properties: {
          academicPeriodId: { type: 'string', format: 'uuid' },
          term: { type: 'integer', minimum: 1, maximum: 4, example: 1 },
          average: { type: 'number', nullable: true, example: 90.25 },
          subjects: {
            type: 'array',
            items: {
              type: 'object',
              required: ['subject', 'average'],
              properties: {
                subject: { type: 'string', example: 'Science' },
                average: { type: 'number', nullable: true, example: 92.0 },
              },
            },
          },
        },
      },
    },
  },
};

const promotionEvaluationSchema = {
  type: 'object',
  required: [
    'enrollmentId',
    'academicPeriodId',
    'studentId',
    'gradeCount',
    'threshold',
    'promotionStatus',
  ],
  properties: {
    enrollmentId: { type: 'string', format: 'uuid' },
    academicPeriodId: { type: 'string', format: 'uuid' },
    studentId: { type: 'string', format: 'uuid' },
    gradeCount: { type: 'integer', example: 4 },
    average: { type: 'number', nullable: true, example: 72.5 },
    threshold: { type: 'integer', example: 60 },
    promotionStatus: {
      type: 'string',
      enum: ['promoted', 'retained', 'pending'],
      example: 'promoted',
    },
  },
};

const studentAcademicSummarySchema = {
  type: 'object',
  required: ['institutionId', 'year', 'student', 'annualSubjects', 'termAverages', 'enrollments'],
  properties: {
    institutionId: { type: 'string', format: 'uuid' },
    year: { type: 'integer', example: 2026 },
    student: {
      type: 'object',
      required: ['id', 'firstName', 'lastName', 'fullName'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        firstName: { type: 'string', example: 'Jane' },
        lastName: { type: 'string', example: 'Doe' },
        fullName: { type: 'string', example: 'Jane Doe' },
        dateOfBirth: { type: 'string', nullable: true, example: '2012-03-15' },
      },
    },
    annualAverage: { type: 'number', nullable: true, example: 86.75 },
    annualSubjects: {
      type: 'array',
      items: {
        type: 'object',
        required: ['subject', 'average'],
        properties: {
          subject: { type: 'string', example: 'Mathematics' },
          average: { type: 'number', nullable: true, example: 88.5 },
        },
      },
    },
    termAverages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['academicPeriodId', 'term', 'subjects'],
        properties: {
          academicPeriodId: { type: 'string', format: 'uuid' },
          term: { type: 'integer', minimum: 1, maximum: 4, example: 1 },
          average: { type: 'number', nullable: true, example: 84.5 },
          promotionStatus: {
            type: 'string',
            nullable: true,
            example: 'promoted',
          },
          subjects: {
            type: 'array',
            items: {
              type: 'object',
              required: ['subject', 'average'],
              properties: {
                subject: { type: 'string', example: 'Science' },
                average: { type: 'number', nullable: true, example: 82.0 },
              },
            },
          },
        },
      },
    },
    enrollments: {
      type: 'array',
      items: {
        type: 'object',
        required: ['enrollmentId', 'academicPeriodId', 'term'],
        properties: {
          enrollmentId: { type: 'string', format: 'uuid' },
          academicPeriodId: { type: 'string', format: 'uuid' },
          term: { type: 'integer', minimum: 1, maximum: 4, example: 1 },
          status: { type: 'string', nullable: true, example: 'active' },
          promotionStatus: {
            type: 'string',
            nullable: true,
            example: 'promoted',
          },
        },
      },
    },
  },
};

export function buildOpenApiDocument() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Edunic API',
      version: '0.1.0',
      description:
        'Interactive API reference for the Edunic academic management platform.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    tags: [
      {
        name: 'Bootstrap',
        description: 'Temporary operational endpoints for database bootstrap',
      },
      {
        name: 'Auth',
        description: 'Authentication endpoints for obtaining bearer tokens',
      },
      {
        name: 'Audit Logs',
        description: 'Administrative access to audit trail records',
      },
      {
        name: 'Extensions',
        description: 'Extension registry and per-institution enablement',
      },
      {
        name: 'Custom Fields',
        description: 'Tenant-scoped custom field definitions and values',
      },
      {
        name: 'Notifications',
        description: 'Internal notifications generated by domain events',
      },
      {
        name: 'Academic Averages',
        description: 'Computed annual and term-based academic averages',
      },
      {
        name: 'Reports',
        description: 'Read-only reporting endpoints for academic summaries',
      },
      { name: 'Academic Periods', description: 'Academic period CRUD endpoints' },
      { name: 'Attendance', description: 'Attendance CRUD endpoints' },
      { name: 'Enrollments', description: 'Enrollment CRUD endpoints' },
      { name: 'Grades', description: 'Grade CRUD endpoints' },
      { name: 'Guardians', description: 'Guardian CRUD and student-link endpoints' },
      { name: 'Health', description: 'Service health endpoints' },
      { name: 'Institutions', description: 'Institution CRUD endpoints' },
      { name: 'Students', description: 'Student CRUD endpoints' },
    ],
    paths: {
      '/extensions': {
        get: {
          tags: ['Extensions'],
          summary: 'List registered extensions',
          responses: {
            200: {
              description: 'Extensions page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: extensionSchema },
                      meta: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
          },
        },
        post: {
          tags: ['Extensions'],
          summary: 'Create an extension',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['key', 'name'],
                  properties: {
                    key: { type: 'string', example: 'notifications' },
                    name: { type: 'string', example: 'Notifications' },
                    enabled: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Extension created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { data: extensionSchema },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            409: { $ref: '#/components/responses/Conflict' },
          },
        },
      },
      '/extensions/{extensionKey}': {
        patch: {
          tags: ['Extensions'],
          summary: 'Update an extension',
          parameters: [
            {
              name: 'extensionKey',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', nullable: true },
                    enabled: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Extension updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { data: extensionSchema },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/institutions/{institutionId}/extensions': {
        get: {
          tags: ['Extensions'],
          summary: 'List extensions enabled for an institution',
          parameters: [
            {
              name: 'institutionId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Institution extensions',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: institutionExtensionSchema,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/institutions/{institutionId}/extensions/{extensionKey}': {
        put: {
          tags: ['Extensions'],
          summary: 'Enable or configure an extension for an institution',
          parameters: [
            {
              name: 'institutionId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'extensionKey',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    config: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Institution extension saved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { data: institutionExtensionSchema },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Extensions'],
          summary: 'Disable an extension for an institution',
          parameters: [
            {
              name: 'institutionId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'extensionKey',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: { description: 'Institution extension disabled' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/custom-fields': {
        get: {
          tags: ['Custom Fields'],
          summary: 'List custom fields',
          parameters: [
            institutionIdHeaderSchema,
            { name: 'entity', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Custom fields page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: customFieldSchema },
                      meta: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Custom Fields'],
          summary: 'Create a custom field',
          parameters: [institutionIdHeaderSchema],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['entity', 'name', 'type'],
                  properties: {
                    entity: { type: 'string', example: 'students' },
                    name: { type: 'string', example: 'Scholarship' },
                    type: {
                      type: 'string',
                      enum: ['text', 'number', 'date', 'boolean', 'select'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Custom field created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { data: customFieldSchema },
                  },
                },
              },
            },
          },
        },
      },
      '/custom-fields/{customFieldId}': {
        patch: {
          tags: ['Custom Fields'],
          summary: 'Update a custom field',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'customFieldId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: { description: 'Custom field updated' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Custom Fields'],
          summary: 'Delete a custom field',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'customFieldId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: { description: 'Custom field deleted' },
            409: { $ref: '#/components/responses/Conflict' },
          },
        },
      },
      '/custom-fields/values/{entity}/{entityId}': {
        get: {
          tags: ['Custom Fields'],
          summary: 'List custom field values for an entity record',
          parameters: [
            institutionIdHeaderSchema,
            { name: 'entity', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'entityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: {
              description: 'Custom field values',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: customFieldValueSchema },
                    },
                  },
                },
              },
            },
          },
        },
        put: {
          tags: ['Custom Fields'],
          summary: 'Upsert custom field values for an entity record',
          parameters: [
            institutionIdHeaderSchema,
            { name: 'entity', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'entityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Custom field values saved' },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
      },
      '/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'List internal notifications',
          parameters: [
            institutionIdHeaderSchema,
            { name: 'unreadOnly', in: 'query', schema: { type: 'boolean' } },
            { name: 'eventName', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Notifications page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: notificationSchema },
                      meta: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/notifications/{notificationId}/read': {
        patch: {
          tags: ['Notifications'],
          summary: 'Mark a notification as read',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'notificationId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Notification marked as read',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { data: notificationSchema },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/audit-logs': {
        get: {
          tags: ['Audit Logs'],
          summary: 'List audit logs',
          description:
            'Returns audit trail records for successful mutating requests within the authenticated institution. Admin role required.',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'entity',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'action',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['create', 'update', 'delete'],
              },
            },
            {
              name: 'userId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Audit logs page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: auditLogSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Log in and obtain a bearer token',
          description:
            'Authenticates a user for a specific institution and returns a JWT bearer token that resolves role-based permissions from user_institution_roles.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'institutionId'],
                  properties: {
                    email: { type: 'string', format: 'email', example: 'admin@central.edu' },
                    password: { type: 'string', example: 'admin1234' },
                    institutionId: {
                      type: 'string',
                      format: 'uuid',
                      example: '00000000-0000-0000-0000-000000000001',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Authentication succeeded',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          token: { type: 'string' },
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              email: { type: 'string', format: 'email' },
                              institutionId: { type: 'string', format: 'uuid' },
                              role: {
                                type: 'string',
                                enum: ['admin', 'teacher', 'parent'],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/reports/students/{studentId}/academic-summary': {
        get: {
          tags: ['Reports'],
          summary: 'Get a student academic summary report',
          description:
            'Returns a reporting-friendly academic summary for the selected student and year, including averages, per-term breakdowns, and enrollment promotion statuses.',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'year',
              in: 'query',
              required: true,
              schema: { type: 'integer', minimum: 2000, maximum: 2100 },
            },
          ],
          responses: {
            200: {
              description: 'Student academic summary report',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: studentAcademicSummarySchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/StudentReportNotFound' },
          },
        },
      },
      '/reports/students/{studentId}/academic-summary/pdf': {
        get: {
          tags: ['Reports'],
          summary: 'Download a student academic summary PDF',
          description:
            'Generates a PDF export for the student academic summary report for the selected year.',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'year',
              in: 'query',
              required: true,
              schema: { type: 'integer', minimum: 2000, maximum: 2100 },
            },
          ],
          responses: {
            200: {
              description: 'PDF file',
              content: {
                'application/pdf': {
                  schema: {
                    type: 'string',
                    format: 'binary',
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/StudentReportNotFound' },
          },
        },
      },
      '/academic-averages/students/{studentId}': {
        get: {
          tags: ['Academic Averages'],
          summary: 'Get annual and term averages for a student',
          description:
            'Computes annual averages for the selected year and uses academic period term as the current bimestral bucket.',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'year',
              in: 'query',
              required: true,
              schema: { type: 'integer', minimum: 2000, maximum: 2100 },
            },
          ],
          responses: {
            200: {
              description: 'Student academic averages',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: academicAverageSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/StudentAverageNotFound' },
          },
        },
      },
      '/admin/bootstrap': {
        post: {
          tags: ['Bootstrap'],
          summary: 'Run migrations and seed data',
          description:
            'Temporary internal endpoint. This mutates the database by running migrations first and seed data second. Remove it after deployment bootstrap is stable.',
          responses: {
            200: {
              description: 'Bootstrap completed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        required: ['migration', 'seed', 'durationMs'],
                        properties: {
                          migration: { type: 'string', example: 'ok' },
                          seed: { type: 'string', example: 'ok' },
                          durationMs: { type: 'integer', example: 1320 },
                        },
                      },
                    },
                  },
                },
              },
            },
            500: { $ref: '#/components/responses/BootstrapFailed' },
          },
        },
      },
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Check API health',
          responses: {
            200: {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/academic-periods': {
        get: {
          tags: ['Academic Periods'],
          summary: 'List academic periods',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'year',
              in: 'query',
              schema: { type: 'integer', minimum: 2000, maximum: 2100 },
            },
            {
              name: 'term',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 4 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 25,
              },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['createdAt', 'year', 'term', 'startDate'],
                default: 'year',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Academic periods page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: academicPeriodSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
        post: {
          tags: ['Academic Periods'],
          summary: 'Create an academic period',
          parameters: [institutionIdHeaderSchema],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['year', 'term'],
                  properties: {
                    year: { type: 'integer', minimum: 2000, maximum: 2100 },
                    term: { type: 'integer', minimum: 1, maximum: 4 },
                    startDate: {
                      type: 'string',
                      example: '2026-01-15T00:00:00.000Z',
                    },
                    endDate: {
                      type: 'string',
                      example: '2026-03-30T00:00:00.000Z',
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Academic period created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: academicPeriodSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            409: { $ref: '#/components/responses/AcademicPeriodConflict' },
          },
        },
      },
      '/academic-periods/{academicPeriodId}': {
        get: {
          tags: ['Academic Periods'],
          summary: 'Get an academic period by id',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'academicPeriodId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Academic period details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: academicPeriodSchema,
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/AcademicPeriodNotFound' },
          },
        },
        patch: {
          tags: ['Academic Periods'],
          summary: 'Update an academic period',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'academicPeriodId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    year: { type: 'integer', minimum: 2000, maximum: 2100 },
                    term: { type: 'integer', minimum: 1, maximum: 4 },
                    startDate: {
                      type: 'string',
                      nullable: true,
                      example: '2026-01-15T00:00:00.000Z',
                    },
                    endDate: {
                      type: 'string',
                      nullable: true,
                      example: '2026-03-30T00:00:00.000Z',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Academic period updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: academicPeriodSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/AcademicPeriodNotFound' },
            409: { $ref: '#/components/responses/AcademicPeriodConflict' },
          },
        },
        delete: {
          tags: ['Academic Periods'],
          summary: 'Delete an academic period',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'academicPeriodId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Academic period deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/AcademicPeriodNotFound' },
            409: { $ref: '#/components/responses/AcademicPeriodDeleteConflict' },
          },
        },
      },
      '/attendance': {
        get: {
          tags: ['Attendance'],
          summary: 'List attendance records',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'enrollmentId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['present', 'absent', 'late'],
              },
            },
            {
              name: 'date',
              in: 'query',
              schema: { type: 'string', example: '2026-04-29' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 25,
              },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['createdAt', 'date', 'status'],
                default: 'date',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Attendance page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: attendanceSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
        post: {
          tags: ['Attendance'],
          summary: 'Create an attendance record',
          parameters: [institutionIdHeaderSchema],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['enrollmentId', 'date', 'status'],
                  properties: {
                    enrollmentId: { type: 'string', format: 'uuid' },
                    date: {
                      type: 'string',
                      example: '2026-04-29T00:00:00.000Z',
                    },
                    status: {
                      type: 'string',
                      enum: ['present', 'absent', 'late'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Attendance record created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: attendanceSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/AttendanceRelatedNotFound' },
          },
        },
      },
      '/attendance/{attendanceId}': {
        get: {
          tags: ['Attendance'],
          summary: 'Get an attendance record by id',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'attendanceId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Attendance details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: attendanceSchema,
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/AttendanceNotFound' },
          },
        },
        patch: {
          tags: ['Attendance'],
          summary: 'Update an attendance record',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'attendanceId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    date: {
                      type: 'string',
                      example: '2026-04-29T00:00:00.000Z',
                    },
                    status: {
                      type: 'string',
                      enum: ['present', 'absent', 'late'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Attendance record updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: attendanceSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/AttendanceNotFound' },
          },
        },
        delete: {
          tags: ['Attendance'],
          summary: 'Delete an attendance record',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'attendanceId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Attendance record deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/AttendanceNotFound' },
          },
        },
      },
      '/grades': {
        get: {
          tags: ['Grades'],
          summary: 'List grades',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'enrollmentId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'subject',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 25,
              },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['createdAt', 'subject', 'score'],
                default: 'createdAt',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Grades page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: gradeSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
        post: {
          tags: ['Grades'],
          summary: 'Create a grade',
          parameters: [institutionIdHeaderSchema],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['enrollmentId', 'subject', 'score'],
                  properties: {
                    enrollmentId: { type: 'string', format: 'uuid' },
                    subject: { type: 'string', example: 'Mathematics' },
                    score: {
                      type: 'integer',
                      minimum: 0,
                      maximum: 100,
                      example: 87,
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Grade created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: gradeSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/GradeRelatedNotFound' },
          },
        },
      },
      '/grades/{gradeId}': {
        get: {
          tags: ['Grades'],
          summary: 'Get a grade by id',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'gradeId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Grade details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: gradeSchema,
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/GradeNotFound' },
          },
        },
        patch: {
          tags: ['Grades'],
          summary: 'Update a grade',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'gradeId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    subject: { type: 'string' },
                    score: {
                      type: 'integer',
                      minimum: 0,
                      maximum: 100,
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Grade updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: gradeSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/GradeNotFound' },
          },
        },
        delete: {
          tags: ['Grades'],
          summary: 'Delete a grade',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'gradeId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Grade deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/GradeNotFound' },
          },
        },
      },
      '/enrollments': {
        get: {
          tags: ['Enrollments'],
          summary: 'List enrollments',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'studentId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'academicPeriodId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'withdrawn', 'completed'],
              },
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 25,
              },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['createdAt', 'status', 'studentName'],
                default: 'createdAt',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Enrollments page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: enrollmentSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
        post: {
          tags: ['Enrollments'],
          summary: 'Create an enrollment',
          parameters: [institutionIdHeaderSchema],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['studentId', 'academicPeriodId'],
                  properties: {
                    studentId: { type: 'string', format: 'uuid' },
                    academicPeriodId: { type: 'string', format: 'uuid' },
                    classroomId: {
                      type: 'string',
                      format: 'uuid',
                      nullable: true,
                    },
                    status: {
                      type: 'string',
                      enum: ['active', 'withdrawn', 'completed'],
                      default: 'active',
                    },
                    promotionStatus: {
                      type: 'string',
                      nullable: true,
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Enrollment created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: enrollmentSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/EnrollmentRelatedNotFound' },
            409: { $ref: '#/components/responses/EnrollmentConflict' },
          },
        },
      },
      '/enrollments/{enrollmentId}': {
        get: {
          tags: ['Enrollments'],
          summary: 'Get an enrollment by id',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'enrollmentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Enrollment details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: enrollmentSchema,
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/EnrollmentNotFound' },
          },
        },
        patch: {
          tags: ['Enrollments'],
          summary: 'Update an enrollment',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'enrollmentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    classroomId: {
                      type: 'string',
                      format: 'uuid',
                      nullable: true,
                    },
                    status: {
                      type: 'string',
                      enum: ['active', 'withdrawn', 'completed'],
                    },
                    promotionStatus: {
                      type: 'string',
                      nullable: true,
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Enrollment updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: enrollmentSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/EnrollmentNotFound' },
          },
        },
        delete: {
          tags: ['Enrollments'],
          summary: 'Delete an enrollment',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'enrollmentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Enrollment deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/EnrollmentNotFound' },
            409: { $ref: '#/components/responses/EnrollmentDeleteConflict' },
          },
        },
        },
      '/enrollments/{enrollmentId}/promotion': {
        post: {
          tags: ['Enrollments'],
          summary: 'Evaluate promotion rules for an enrollment',
          description:
            'Computes the enrollment grade average, applies the default passing threshold of 60, and persists promotionStatus as promoted, retained, or pending when no grades exist.',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'enrollmentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Promotion evaluation result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: promotionEvaluationSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/EnrollmentNotFound' },
          },
        },
      },
      '/institutions': {
        get: {
          tags: ['Institutions'],
          summary: 'List institutions',
          parameters: [
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 25,
              },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['createdAt', 'name'],
                default: 'createdAt',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Institutions page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: institutionSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
        post: {
          tags: ['Institutions'],
          summary: 'Create an institution',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Colegio Central' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Institution created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: institutionSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
      },
      '/institutions/{institutionId}': {
        get: {
          tags: ['Institutions'],
          summary: 'Get an institution by id',
          parameters: [
            {
              name: 'institutionId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Institution details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: institutionSchema,
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/InstitutionNotFound' },
          },
        },
        patch: {
          tags: ['Institutions'],
          summary: 'Update an institution',
          parameters: [
            {
              name: 'institutionId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Institution updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: institutionSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/InstitutionNotFound' },
          },
        },
        delete: {
          tags: ['Institutions'],
          summary: 'Delete an institution',
          parameters: [
            {
              name: 'institutionId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Institution deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/InstitutionNotFound' },
            409: { $ref: '#/components/responses/InstitutionConflict' },
          },
        },
      },
      '/guardians': {
        get: {
          tags: ['Guardians'],
          summary: 'List guardians',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['name', 'phone'],
                default: 'name',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'asc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Guardians page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: guardianSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
        post: {
          tags: ['Guardians'],
          summary: 'Create a guardian',
          parameters: [institutionIdHeaderSchema],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Maria Lopez' },
                    phone: { type: 'string', nullable: true, example: '+50255550000' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Guardian created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: guardianSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
      },
      '/guardians/{guardianId}': {
        get: {
          tags: ['Guardians'],
          summary: 'Get a guardian by id',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'guardianId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Guardian details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: guardianSchema,
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/GuardianNotFound' },
          },
        },
        patch: {
          tags: ['Guardians'],
          summary: 'Update a guardian',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'guardianId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    phone: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Guardian updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: guardianSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/GuardianNotFound' },
          },
        },
        delete: {
          tags: ['Guardians'],
          summary: 'Delete a guardian',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'guardianId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Guardian deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/GuardianNotFound' },
            409: { $ref: '#/components/responses/GuardianConflict' },
          },
        },
      },
      '/students/{studentId}/guardians': {
        get: {
          tags: ['Guardians'],
          summary: 'List guardians linked to a student',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Student guardians',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: guardianSchema,
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/students/{studentId}/guardians/{guardianId}': {
        post: {
          tags: ['Guardians'],
          summary: 'Link a guardian to a student',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'guardianId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            201: {
              description: 'Guardian linked to student',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          studentId: { type: 'string', format: 'uuid' },
                          guardian: guardianSchema,
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/NotFound' },
            409: { $ref: '#/components/responses/GuardianStudentLinkConflict' },
          },
        },
        delete: {
          tags: ['Guardians'],
          summary: 'Unlink a guardian from a student',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'guardianId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Guardian unlinked from student',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          studentId: { type: 'string', format: 'uuid' },
                          guardianId: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/GuardianStudentLinkNotFound' },
          },
        },
      },
      '/students': {
        get: {
          tags: ['Students'],
          summary: 'List students',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'sortBy',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['createdAt', 'firstName', 'lastName'],
                default: 'createdAt',
              },
            },
            {
              name: 'sortOrder',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
            },
          ],
          responses: {
            200: {
              description: 'Students page',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: studentSchema,
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
        post: {
          tags: ['Students'],
          summary: 'Create a student',
          parameters: [institutionIdHeaderSchema],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['firstName', 'lastName'],
                  properties: {
                    firstName: { type: 'string', example: 'Jane' },
                    lastName: { type: 'string', example: 'Doe' },
                    dateOfBirth: {
                      type: 'string',
                      example: '2012-03-15',
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Student created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: studentSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
          },
        },
      },
      '/students/{studentId}': {
        get: {
          tags: ['Students'],
          summary: 'Get a student by id',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Student details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: studentSchema,
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Students'],
          summary: 'Update a student',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    dateOfBirth: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Student updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: studentSchema,
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Students'],
          summary: 'Delete a student',
          parameters: [
            institutionIdHeaderSchema,
            {
              name: 'studentId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: 'Student deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/NotFound' },
            409: { $ref: '#/components/responses/Conflict' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      responses: {
        BadRequest: {
          description: 'Invalid request',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Invalid request' },
                },
              },
            },
          },
        },
        BootstrapFailed: {
          description: 'Bootstrap migration or seed failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example:
                      'Bootstrap failed during migration: DATABASE_URL is not set',
                  },
                },
              },
            },
          },
        },
        Unauthorized: {
          description: 'Authentication failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Authentication is required',
                  },
                },
              },
            },
          },
        },
        Forbidden: {
          description: 'Authenticated user does not have permission',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'You do not have permission to perform this action',
                  },
                },
              },
            },
          },
        },
        StudentAverageNotFound: {
          description: 'Student not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Student not found',
                  },
                },
              },
            },
          },
        },
        StudentReportNotFound: {
          description: 'Student not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Student not found',
                  },
                },
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Student not found' },
                },
              },
            },
          },
        },
        Conflict: {
          description: 'Business rule conflict',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Student cannot be deleted while enrollments exist',
                  },
                },
              },
            },
          },
        },
        InstitutionNotFound: {
          description: 'Institution not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Institution not found',
                  },
                },
              },
            },
          },
        },
        InstitutionConflict: {
          description: 'Institution cannot be deleted because related data exists',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example:
                      'Institution cannot be deleted while dependent academic records exist',
                  },
                },
              },
            },
          },
        },
        EnrollmentNotFound: {
          description: 'Enrollment not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Enrollment not found',
                  },
                },
              },
            },
          },
        },
        EnrollmentRelatedNotFound: {
          description: 'Related academic record not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Academic period not found',
                  },
                },
              },
            },
          },
        },
        EnrollmentConflict: {
          description: 'Student is already enrolled in the academic period',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example:
                      'Student is already enrolled in this academic period',
                  },
                },
              },
            },
          },
        },
        EnrollmentDeleteConflict: {
          description: 'Enrollment cannot be deleted because dependent records exist',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example:
                      'Enrollment cannot be deleted while grades or attendance records exist',
                  },
                },
              },
            },
          },
        },
        GradeNotFound: {
          description: 'Grade not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Grade not found',
                  },
                },
              },
            },
          },
        },
        GradeRelatedNotFound: {
          description: 'Related enrollment not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Enrollment not found',
                  },
                },
              },
            },
          },
        },
        GuardianNotFound: {
          description: 'Guardian not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Guardian not found',
                  },
                },
              },
            },
          },
        },
        GuardianConflict: {
          description: 'Guardian cannot be deleted because student links exist',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Guardian cannot be deleted while linked to students',
                  },
                },
              },
            },
          },
        },
        GuardianStudentLinkConflict: {
          description: 'Guardian is already linked to this student',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Guardian is already linked to this student',
                  },
                },
              },
            },
          },
        },
        GuardianStudentLinkNotFound: {
          description: 'Guardian link for this student was not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Guardian link for this student was not found',
                  },
                },
              },
            },
          },
        },
        AttendanceNotFound: {
          description: 'Attendance record not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Attendance record not found',
                  },
                },
              },
            },
          },
        },
        AttendanceRelatedNotFound: {
          description: 'Related enrollment not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Enrollment not found',
                  },
                },
              },
            },
          },
        },
        AcademicPeriodNotFound: {
          description: 'Academic period not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Academic period not found',
                  },
                },
              },
            },
          },
        },
        AcademicPeriodConflict: {
          description: 'Academic period already exists for year and term',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example:
                      'Academic period already exists for this year and term',
                  },
                },
              },
            },
          },
        },
        AcademicPeriodDeleteConflict: {
          description: 'Academic period cannot be deleted because enrollments exist',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example:
                      'Academic period cannot be deleted while enrollments exist',
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
