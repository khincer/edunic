// OpenAPI paths for the school administration (teachers, materias, payments,
// the email delivery panel) and the dependency probes. Spread into
// buildOpenApiDocument().paths; the drift test (openapi-routes.spec) keeps
// them in step with the registered routes.

const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });

const uuidPath = (name: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
});

const jsonBody = (schema: Record<string, unknown>) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const dataResponse = (description: string, data: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data } },
    },
  },
});

const listOf = (items: Record<string, unknown>) => ({ type: 'array', items });

const timestampText = {
  type: 'string',
  description: 'Database timestamp text (YYYY-MM-DD HH:MM:SS, UTC).',
  example: '2026-02-03 10:00:00',
};

const roleEnum = {
  type: 'string',
  enum: ['director', 'vice_director', 'subdirector', 'teacher', 'parent'],
};

const teacherSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    role: roleEnum,
    createdAt: timestampText,
  },
};

const teacherClassroomSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    gradeLevel: { type: 'integer' },
    section: { type: 'string', nullable: true },
  },
};

const subjectSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Mathematics' },
    code: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    active: { type: 'boolean' },
    createdAt: timestampText,
  },
};

const topicSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    subjectId: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Fractions' },
    createdAt: timestampText,
  },
};

const paymentStatus = { type: 'string', enum: ['pending', 'paid', 'cancelled'] };

const paymentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    studentId: { type: 'string', format: 'uuid' },
    concept: { type: 'string', example: 'Tuition March' },
    amountCents: { type: 'integer', example: 150000 },
    dueDate: { ...timestampText, nullable: true },
    paidAt: { ...timestampText, nullable: true },
    method: { type: 'string', example: 'cash' },
    status: paymentStatus,
    receiptNumber: { type: 'string', example: 'R-000001' },
    recordedByUserId: { type: 'string', format: 'uuid' },
    note: { type: 'string', nullable: true },
    createdAt: timestampText,
  },
};

const balanceSchema = {
  type: 'object',
  properties: {
    studentId: { type: 'string', format: 'uuid' },
    studentName: { type: 'string' },
    billedCents: { type: 'integer' },
    paidCents: { type: 'integer' },
    outstandingCents: { type: 'integer' },
    overdueCount: { type: 'integer' },
  },
};

const emailDeliverySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    eventId: { type: 'string', format: 'uuid' },
    eventName: { type: 'string', example: 'grade.submitted' },
    recipientAddress: { type: 'string', format: 'email' },
    recipientSource: { type: 'string', enum: ['guardian', 'user'] },
    studentId: { type: 'string', format: 'uuid', nullable: true },
    status: {
      type: 'string',
      enum: ['queued', 'sending', 'sent', 'failed', 'retried'],
    },
    attemptCount: { type: 'integer' },
    providerMessageId: { type: 'string', nullable: true },
    providerError: { type: 'string', nullable: true },
    createdAt: timestampText,
    updatedAt: timestampText,
    sentAt: { ...timestampText, nullable: true },
  },
};

const deletedLink = (keys: string[]) => ({
  type: 'object',
  properties: {
    ...Object.fromEntries(
      keys.map((key) => [key, { type: 'string', format: 'uuid' }])
    ),
    deleted: { type: 'boolean', example: true },
  },
});

const subjectIdsBody = jsonBody({
  type: 'object',
  required: ['subjectIds'],
  properties: {
    subjectIds: listOf({ type: 'string', format: 'uuid' }),
  },
});

const pageMeta = {
  type: 'object',
  properties: {
    total: { type: 'integer' },
    limit: { type: 'integer' },
    offset: { type: 'integer' },
  },
};

const limitOffset = (defaultLimit: number) => [
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: defaultLimit },
  },
  {
    name: 'offset',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 0, default: 0 },
  },
];

export const administrationTags = [
  { name: 'Teachers', description: 'The teacher roster and classroom assignments' },
  { name: 'Subjects', description: 'Materias, their temas, and who offers or teaches them' },
  { name: 'Payments', description: 'Offline payment ledger, balances and receipts' },
];

export const administrationPaths = {
  '/teachers': {
    get: {
      tags: ['Teachers'],
      summary: 'List the staff accounts',
      parameters: limitOffset(25),
      responses: {
        200: {
          description: 'Staff page',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: listOf(teacherSchema), meta: pageMeta },
              },
            },
          },
        },
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
      },
    },
    post: {
      tags: ['Teachers'],
      summary: 'Create a staff account, optionally assigned to classrooms',
      requestBody: jsonBody({
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role: { ...roleEnum, default: 'teacher' },
          classroomIds: listOf({ type: 'string', format: 'uuid' }),
        },
      }),
      responses: {
        201: dataResponse('Account created', teacherSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
        409: ref('Conflict'),
      },
    },
  },
  '/teachers/{userId}': {
    get: {
      tags: ['Teachers'],
      summary: 'Get a staff account (the administration, or the teacher themself)',
      parameters: [uuidPath('userId')],
      responses: {
        200: dataResponse('Staff account', teacherSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/teachers/{userId}/role': {
    patch: {
      tags: ['Teachers'],
      summary: "Change an account's role",
      parameters: [uuidPath('userId')],
      requestBody: jsonBody({
        type: 'object',
        required: ['role'],
        properties: { role: roleEnum },
      }),
      responses: {
        200: dataResponse('Role updated', teacherSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/teachers/{userId}/classrooms': {
    get: {
      tags: ['Teachers'],
      summary: "List a teacher's classrooms (the administration, or the teacher themself)",
      parameters: [uuidPath('userId')],
      responses: {
        200: dataResponse('Classrooms', listOf(teacherClassroomSchema)),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
    post: {
      tags: ['Teachers'],
      summary: 'Assign classrooms to a teacher',
      parameters: [uuidPath('userId')],
      requestBody: jsonBody({
        type: 'object',
        required: ['classroomIds'],
        properties: {
          classroomIds: listOf({ type: 'string', format: 'uuid' }),
        },
      }),
      responses: {
        200: dataResponse("The teacher's classrooms", listOf(teacherClassroomSchema)),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/teachers/{userId}/classrooms/{classroomId}': {
    delete: {
      tags: ['Teachers'],
      summary: 'Remove a classroom from a teacher',
      parameters: [uuidPath('userId'), uuidPath('classroomId')],
      responses: {
        200: dataResponse('Assignment removed', deletedLink(['userId', 'classroomId'])),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/subjects': {
    get: {
      tags: ['Subjects'],
      summary: 'List the materias the caller may see',
      description:
        'The administration sees every materia, a teacher the ones assigned to them, a parent the ones their children study.',
      responses: {
        200: dataResponse('Materias', listOf(subjectSchema)),
        401: ref('Unauthorized'),
      },
    },
    post: {
      tags: ['Subjects'],
      summary: 'Create a materia',
      requestBody: jsonBody({
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 120 },
          code: { type: 'string', maxLength: 40 },
          description: { type: 'string', maxLength: 500 },
        },
      }),
      responses: {
        201: dataResponse('Materia created', subjectSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
      },
    },
  },
  '/subjects/{subjectId}': {
    patch: {
      tags: ['Subjects'],
      summary: 'Update a materia',
      parameters: [uuidPath('subjectId')],
      requestBody: jsonBody({
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 120 },
          code: { type: 'string', maxLength: 40 },
          description: { type: 'string', maxLength: 500 },
          active: { type: 'boolean' },
        },
      }),
      responses: {
        200: dataResponse('Materia updated', subjectSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/subjects/{subjectId}/topics': {
    get: {
      tags: ['Subjects'],
      summary: 'List the temas of a materia',
      parameters: [uuidPath('subjectId')],
      responses: {
        200: dataResponse('Temas', listOf(topicSchema)),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        404: ref('NotFound'),
      },
    },
    post: {
      tags: ['Subjects'],
      summary: 'Add a tema to a materia',
      parameters: [uuidPath('subjectId')],
      requestBody: jsonBody({
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', maxLength: 120 } },
      }),
      responses: {
        201: dataResponse('Tema created', topicSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/subjects/{subjectId}/topics/{topicId}': {
    patch: {
      tags: ['Subjects'],
      summary: 'Rename a tema',
      parameters: [uuidPath('subjectId'), uuidPath('topicId')],
      requestBody: jsonBody({
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', maxLength: 120 } },
      }),
      responses: {
        200: dataResponse('Tema updated', topicSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/subjects/classroom/{classroomId}': {
    get: {
      tags: ['Subjects'],
      summary: 'List the materias a grade level offers',
      parameters: [uuidPath('classroomId')],
      responses: {
        200: dataResponse('Materias', listOf(subjectSchema)),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        404: ref('NotFound'),
      },
    },
    post: {
      tags: ['Subjects'],
      summary: 'Offer materias in a grade level',
      parameters: [uuidPath('classroomId')],
      requestBody: subjectIdsBody,
      responses: {
        200: dataResponse('The materias the grade level offers', listOf(subjectSchema)),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/subjects/classroom/{classroomId}/{subjectId}': {
    delete: {
      tags: ['Subjects'],
      summary: 'Stop offering a materia in a grade level',
      parameters: [uuidPath('classroomId'), uuidPath('subjectId')],
      responses: {
        200: dataResponse('Removed', deletedLink(['classroomId', 'subjectId'])),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/subjects/teacher/{teacherUserId}': {
    get: {
      tags: ['Subjects'],
      summary: 'List the materias a teacher is responsible for',
      parameters: [uuidPath('teacherUserId')],
      responses: {
        200: dataResponse('Materias', listOf(subjectSchema)),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
    post: {
      tags: ['Subjects'],
      summary: 'Make a teacher responsible for materias',
      parameters: [uuidPath('teacherUserId')],
      requestBody: subjectIdsBody,
      responses: {
        200: dataResponse("The teacher's materias", listOf(subjectSchema)),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/subjects/teacher/{teacherUserId}/{subjectId}': {
    delete: {
      tags: ['Subjects'],
      summary: 'Remove a materia from a teacher',
      parameters: [uuidPath('teacherUserId'), uuidPath('subjectId')],
      responses: {
        200: dataResponse('Removed', deletedLink(['teacherUserId', 'subjectId'])),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/payments': {
    get: {
      tags: ['Payments'],
      summary: 'List payments',
      description:
        'The administration sees every payment, a parent the payments of their own children. Teachers are refused.',
      parameters: [
        {
          name: 'studentId',
          in: 'query',
          required: false,
          schema: { type: 'string', format: 'uuid' },
        },
        { name: 'status', in: 'query', required: false, schema: paymentStatus },
        ...limitOffset(50),
      ],
      responses: {
        200: {
          description: 'Payments page',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: listOf(paymentSchema), meta: pageMeta },
              },
            },
          },
        },
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
      },
    },
    post: {
      tags: ['Payments'],
      summary: 'Record a payment',
      requestBody: jsonBody({
        type: 'object',
        required: ['studentId', 'concept', 'amountCents', 'method'],
        properties: {
          studentId: { type: 'string', format: 'uuid' },
          concept: { type: 'string', maxLength: 160 },
          amountCents: { type: 'integer', minimum: 1 },
          dueDate: { type: 'string', format: 'date-time' },
          method: { type: 'string', maxLength: 40, example: 'cash' },
          status: { ...paymentStatus, default: 'pending' },
          note: { type: 'string', maxLength: 500 },
        },
      }),
      responses: {
        201: dataResponse('Payment recorded', paymentSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/payments/balances': {
    get: {
      tags: ['Payments'],
      summary: 'What every student owes and what is late',
      responses: {
        200: dataResponse('Balances', listOf(balanceSchema)),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
      },
    },
  },
  '/payments/{paymentId}': {
    get: {
      tags: ['Payments'],
      summary: 'Get a payment',
      parameters: [uuidPath('paymentId')],
      responses: {
        200: dataResponse('Payment', paymentSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
    patch: {
      tags: ['Payments'],
      summary: 'Update a payment',
      parameters: [uuidPath('paymentId')],
      requestBody: jsonBody({
        type: 'object',
        properties: {
          concept: { type: 'string', maxLength: 160 },
          amountCents: { type: 'integer', minimum: 1 },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          method: { type: 'string', maxLength: 40 },
          status: paymentStatus,
          paidAt: { type: 'string', format: 'date-time', nullable: true },
          note: { type: 'string', maxLength: 500 },
        },
      }),
      responses: {
        200: dataResponse('Payment updated', paymentSchema),
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/payments/{paymentId}/receipt': {
    get: {
      tags: ['Payments'],
      summary: 'Download the receipt of a payment (the administration or the parent)',
      parameters: [uuidPath('paymentId')],
      responses: {
        200: {
          description: 'PDF receipt',
          content: {
            'application/pdf': { schema: { type: 'string', format: 'binary' } },
          },
        },
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
  '/notifications/deliveries': {
    get: {
      tags: ['Notifications'],
      summary: 'List email delivery attempts (administration)',
      parameters: [
        {
          name: 'status',
          in: 'query',
          required: false,
          schema: emailDeliverySchema.properties.status,
        },
        {
          name: 'eventName',
          in: 'query',
          required: false,
          schema: { type: 'string', maxLength: 100 },
        },
        {
          name: 'cursor',
          in: 'query',
          required: false,
          description: 'Keyset cursor; `start` opens the first page.',
          schema: { type: 'string' },
        },
        ...limitOffset(25),
      ],
      responses: {
        200: {
          description: 'Delivery page, newest first',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: listOf(emailDeliverySchema),
                  hasMore: { type: 'boolean' },
                  nextCursor: { type: 'string' },
                  meta: pageMeta,
                },
              },
            },
          },
        },
        400: ref('BadRequest'),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
      },
    },
  },
  '/notifications/deliveries/state': {
    get: {
      tags: ['Notifications'],
      summary: 'Whether email is switched on and the sender identity is configured',
      responses: {
        200: dataResponse('Email state', {
          type: 'object',
          properties: {
            emailNotificationsEnabled: { type: 'boolean' },
            senderIdentityConfigured: { type: 'boolean' },
          },
        }),
        401: ref('Unauthorized'),
        403: ref('Forbidden'),
        404: ref('NotFound'),
      },
    },
  },
};

export const operationsPaths = {
  '/health/db': {
    get: {
      tags: ['Health'],
      summary: 'Check the database connection',
      responses: {
        200: {
          description: 'Database reachable',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  database: { type: 'string', example: 'ok' },
                },
              },
            },
          },
        },
        503: {
          description: 'Database unreachable',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'error' },
                  database: { type: 'string', example: 'error' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/ready': {
    get: {
      tags: ['Health'],
      summary: 'Readiness: database, Redis and the event bus',
      responses: {
        200: {
          description: 'Ready',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ready' },
                  failing: listOf({ type: 'string' }),
                },
              },
            },
          },
        },
        503: {
          description: 'A dependency is down',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'not_ready' },
                  failing: listOf({
                    type: 'string',
                    enum: ['database', 'redis', 'event-bus'],
                  }),
                },
              },
            },
          },
        },
      },
    },
  },
};
