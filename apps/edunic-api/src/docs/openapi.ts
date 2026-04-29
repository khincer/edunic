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
      { name: 'Attendance', description: 'Attendance CRUD endpoints' },
      { name: 'Enrollments', description: 'Enrollment CRUD endpoints' },
      { name: 'Grades', description: 'Grade CRUD endpoints' },
      { name: 'Health', description: 'Service health endpoints' },
      { name: 'Institutions', description: 'Institution CRUD endpoints' },
      { name: 'Students', description: 'Student CRUD endpoints' },
    ],
    paths: {
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
      },
    },
  };
}
