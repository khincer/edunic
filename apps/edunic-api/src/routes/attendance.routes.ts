import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  getInstitutionId,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  AttendanceService,
  AttendanceServiceError,
  AttendanceRepository,
  attendanceParamsSchema,
  listAttendanceQuerySchema,
  createAttendanceBodySchema,
  updateAttendanceBodySchema,
} from '@edunic/source/domain/attendance';

const ATTENDANCE_FILTER_SORT_OPTIONS = {
  filterFields: ['status', 'date', 'enrollmentId', 'createdAt'],
  sortFields: ['status', 'date', 'createdAt'],
};

export async function attendanceRoutes(app: FastifyInstance) {
  const attendanceService = new AttendanceService(
    new AttendanceRepository(app.db),
    app.eventBus
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const academicWriteAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher'])],
  };

  app.get('/', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listAttendanceQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      ATTENDANCE_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return attendanceService.listAttendance({
      institutionId,
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:attendanceId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(attendanceParamsSchema, request.params);

    return attendanceService.getAttendance(institutionId, params.attendanceId);
  });

  app.post('/', academicWriteAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createAttendanceBodySchema, request.body);
    const result = await attendanceService.createAttendance({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:attendanceId', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(attendanceParamsSchema, request.params);
    const body = parseWithSchema(updateAttendanceBodySchema, request.body);

    return attendanceService.updateAttendance({
      institutionId,
      attendanceId: params.attendanceId,
      ...body,
    });
  });

  app.delete('/:attendanceId', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(attendanceParamsSchema, request.params);

    return attendanceService.deleteAttendance(
      institutionId,
      params.attendanceId
    );
  });
}
