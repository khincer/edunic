import type { FastifyInstance } from 'fastify';
import {
  parseWithSchema,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  ClassroomActivityRepository,
  ClassroomsService,
  ClassroomsRepository,
  classroomActivityQuerySchema,
  classroomParamsSchema,
  createClassroomBodySchema,
  listClassroomsQuerySchema,
  updateClassroomBodySchema,
} from '@edunic/source/domain/classrooms';
import {
  ADMIN_ROLES,
  AccessRepository,
  AccessService,
  adminAnd,
} from '@edunic/source/domain/authorization';
import { actorOf } from './actor.js';

const CLASSROOM_FILTER_SORT_OPTIONS = {
  filterFields: ['gradeLevel', 'section'],
  sortFields: ['gradeLevel', 'section'],
};

export async function classroomRoutes(app: FastifyInstance) {
  const classroomsService = new ClassroomsService(
    new ClassroomsRepository(app.db),
    {
      repository: new ClassroomActivityRepository(app.db),
      access: new AccessService(new AccessRepository(app.db)),
    }
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };
  const staffAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher'))],
  };

  app.get('/activity', adminOnly, async (request) => {
    const query = parseWithSchema(classroomActivityQuerySchema, request.query);

    return classroomsService.listClassroomActivity({
      since: query.since,
      actor: actorOf(request),
    });
  });

  app.get('/:classroomId/activity', staffAccess, async (request) => {
    const params = parseWithSchema(classroomParamsSchema, request.params);
    const query = parseWithSchema(classroomActivityQuerySchema, request.query);

    return classroomsService.getClassroomActivity({
      classroomId: params.classroomId,
      ...query,
      actor: actorOf(request),
    });
  });

  app.get('/', readAccess, async (request, reply) => {
    const query = parseWithSchema(listClassroomsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      CLASSROOM_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return classroomsService.listClassrooms({
      teacherUserId: request.user?.role === 'teacher' ? request.user.id : undefined,
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:classroomId', readAccess, async (request) => {
    const params = parseWithSchema(classroomParamsSchema, request.params);

    return classroomsService.getClassroom(params.classroomId);
  });

  app.post('/', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createClassroomBodySchema, request.body);
    const result = await classroomsService.createClassroom({
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:classroomId', adminOnly, async (request) => {
    const params = parseWithSchema(classroomParamsSchema, request.params);
    const body = parseWithSchema(updateClassroomBodySchema, request.body);

    return classroomsService.updateClassroom({
      classroomId: params.classroomId,
      ...body,
    });
  });

  app.delete('/:classroomId', adminOnly, async (request) => {
    const params = parseWithSchema(classroomParamsSchema, request.params);

    return classroomsService.deleteClassroom(params.classroomId);
  });
}
