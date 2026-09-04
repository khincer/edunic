import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  StudentsService,
  StudentsServiceError,
  StudentsRepository,
  createStudentBodySchema,
  institutionHeaderSchema,
  listStudentsQuerySchema,
  studentParamsSchema,
  updateStudentBodySchema,
} from '@edunic/source/domain/students';

export async function studentRoutes(app: FastifyInstance) {
  const studentsService = new StudentsService(new StudentsRepository(app.db));
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listStudentsQuerySchema, request.query);

    return studentsService.listStudents({
      institutionId,
      ...query,
    });
  });

  app.get('/:studentId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentParamsSchema, request.params);

    return studentsService.getStudent(institutionId, params.studentId);
  });

  app.post('/', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createStudentBodySchema, request.body);
    const result = await studentsService.createStudent({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:studentId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentParamsSchema, request.params);
    const body = parseWithSchema(updateStudentBodySchema, request.body);

    return studentsService.updateStudent({
      institutionId,
      studentId: params.studentId,
      ...body,
    });
  });

  app.delete('/:studentId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentParamsSchema, request.params);

    return studentsService.deleteStudent(institutionId, params.studentId);
  });
}
