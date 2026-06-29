import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  ClassroomsService,
  ClassroomsServiceError,
} from '../modules/classrooms/application/classrooms.service.js';
import { ClassroomsRepository } from '../modules/classrooms/infrastructure/classrooms.repository.js';
import {
  classroomParamsSchema,
  createClassroomBodySchema,
  institutionHeaderSchema,
  listClassroomsQuerySchema,
  updateClassroomBodySchema,
} from '../modules/classrooms/schemas/classroom.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new ClassroomsServiceError(
        firstIssue?.message ?? 'Invalid request',
        400
      );
    }

    throw error;
  }
}

function getInstitutionId(request: FastifyRequest) {
  const headers = parseWithSchema(institutionHeaderSchema, request.headers);
  return headers['x-institution-id'];
}

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
