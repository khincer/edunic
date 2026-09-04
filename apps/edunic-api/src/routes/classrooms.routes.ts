import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  ClassroomsService,
  ClassroomsServiceError,
  ClassroomsRepository,
  classroomParamsSchema,
  createClassroomBodySchema,
  institutionHeaderSchema,
  listClassroomsQuerySchema,
  updateClassroomBodySchema,
} from '@edunic/source/domain/classrooms';

export async function classroomRoutes(app: FastifyInstance) {
  const classroomsService = new ClassroomsService(
    new ClassroomsRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listClassroomsQuerySchema, request.query);

    return classroomsService.listClassrooms({
      institutionId,
      teacherUserId: request.user?.role === 'teacher' ? request.user.id : undefined,
      ...query,
    });
  });

  app.get('/:classroomId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(classroomParamsSchema, request.params);

    return classroomsService.getClassroom(institutionId, params.classroomId);
  });

  app.post('/', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createClassroomBodySchema, request.body);
    const result = await classroomsService.createClassroom({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:classroomId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(classroomParamsSchema, request.params);
    const body = parseWithSchema(updateClassroomBodySchema, request.body);

    return classroomsService.updateClassroom({
      institutionId,
      classroomId: params.classroomId,
      ...body,
    });
  });

  app.delete('/:classroomId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(classroomParamsSchema, request.params);

    return classroomsService.deleteClassroom(institutionId, params.classroomId);
  });
}
