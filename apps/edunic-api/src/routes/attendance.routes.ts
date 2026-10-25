import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import { AccessRepository, AccessService, adminAnd } from '@edunic/source/domain/authorization';
import {
  AttendanceService,
  AttendanceServiceError,
  AttendanceRepository,
  attendanceParamsSchema,
  listAttendanceQuerySchema,
  createAttendanceBodySchema,
  updateAttendanceBodySchema,
} from '@edunic/source/domain/attendance';
import { actorOf } from './actor.js';

const ATTENDANCE_FILTER_SORT_OPTIONS = {
  filterFields: ['status', 'date', 'enrollmentId', 'createdAt'],
  sortFields: ['status', 'date', 'createdAt'],
};

export async function attendanceRoutes(app: FastifyInstance) {
  const attendanceService = new AttendanceService(
    new AttendanceRepository(app.db),
    app.eventBus,
    new AccessService(new AccessRepository(app.db))
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };
  const academicWriteAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher'))],
  };

  app.get('/', readAccess, async (request, reply) => {
    const query = parseWithSchema(listAttendanceQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      ATTENDANCE_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return attendanceService.listAttendance({
      actor: actorOf(request),
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:attendanceId', readAccess, async (request) => {
    const params = parseWithSchema(attendanceParamsSchema, request.params);

    return attendanceService.getAttendance(params.attendanceId, actorOf(request));
  });

  app.post('/', academicWriteAccess, async (request, reply) => {
    const body = parseWithSchema(createAttendanceBodySchema, request.body);
    const result = await attendanceService.createAttendance({
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:attendanceId', academicWriteAccess, async (request) => {
    const params = parseWithSchema(attendanceParamsSchema, request.params);
    const body = parseWithSchema(updateAttendanceBodySchema, request.body);

    return attendanceService.updateAttendance({
      attendanceId: params.attendanceId,
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
      ...body,
    });
  });

  app.delete('/:attendanceId', academicWriteAccess, async (request) => {
    const params = parseWithSchema(attendanceParamsSchema, request.params);

    return attendanceService.deleteAttendance(params.attendanceId, {
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
    });
  });
}
