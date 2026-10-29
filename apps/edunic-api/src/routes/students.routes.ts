import type { FastifyInstance } from 'fastify';
import {
  parseWithSchema,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  StudentsService,
  StudentsRepository,
  createStudentBodySchema,
  listStudentsQuerySchema,
  registerStudentBodySchema,
  studentParamsSchema,
  updateStudentBodySchema,
} from '@edunic/source/domain/students';
import {
  AccessRepository,
  AccessService,
  ADMIN_ROLES,
  adminAnd,
} from '@edunic/source/domain/authorization';
import { actorOf } from './actor.js';

const STUDENT_FILTER_SORT_OPTIONS = {
  filterFields: [
    'firstName',
    'secondName',
    'firstLastName',
    'secondLastName',
    'dateOfBirth',
    'createdAt',
  ],
  sortFields: [
    'firstName',
    'secondName',
    'firstLastName',
    'secondLastName',
    'dateOfBirth',
    'createdAt',
  ],
};

export async function studentRoutes(app: FastifyInstance) {
  const studentsService = new StudentsService(
    new StudentsRepository(app.db),
    new AccessService(new AccessRepository(app.db)),
    app.eventBus
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };

  app.get('/', readAccess, async (request, reply) => {
    const query = parseWithSchema(listStudentsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      STUDENT_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return studentsService.listStudents({
      actor: actorOf(request),
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:studentId', readAccess, async (request) => {
    const params = parseWithSchema(studentParamsSchema, request.params);

    return studentsService.getStudent(params.studentId, actorOf(request));
  });

  app.post('/', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createStudentBodySchema, request.body);
    const result = await studentsService.createStudent(body);

    return reply.status(201).send(result);
  });

  app.post('/register', adminOnly, async (request, reply) => {
    const body = parseWithSchema(registerStudentBodySchema, request.body);
    const result = await studentsService.registerStudent(body);

    return reply.status(201).send(result);
  });

  app.patch('/:studentId', adminOnly, async (request) => {
    const params = parseWithSchema(studentParamsSchema, request.params);
    const body = parseWithSchema(updateStudentBodySchema, request.body);

    return studentsService.updateStudent({
      studentId: params.studentId,
      ...body,
    });
  });

  app.delete('/:studentId', adminOnly, async (request) => {
    const params = parseWithSchema(studentParamsSchema, request.params);

    return studentsService.deleteStudent(params.studentId);
  });
}
