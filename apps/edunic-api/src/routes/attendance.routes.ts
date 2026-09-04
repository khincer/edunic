import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  AttendanceService,
  AttendanceServiceError,
} from '../modules/attendance/application/attendance.service.js';
import { AttendanceRepository } from '../modules/attendance/infrastructure/attendance.repository.js';
import {
  attendanceParamsSchema,
  createAttendanceBodySchema,
  institutionHeaderSchema,
  listAttendanceQuerySchema,
  updateAttendanceBodySchema,
} from '../modules/attendance/schemas/attendance.schemas.js';

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

  app.get('/', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listAttendanceQuerySchema, request.query);

    return attendanceService.listAttendance({
      institutionId,
      ...query,
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
