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
      { name: 'Health', description: 'Service health endpoints' },
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
      },
    },
  };
}
