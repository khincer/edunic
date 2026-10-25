import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  AcademicAveragesService,
  AcademicAveragesServiceError,
  AcademicAveragesRepository,
  studentAverageParamsSchema,
  studentAverageQuerySchema,
} from '@edunic/source/domain/academic-averages';
import { adminAnd } from '@edunic/source/domain/authorization';

export async function academicAverageRoutes(app: FastifyInstance) {
  const academicAveragesService = new AcademicAveragesService(
    new AcademicAveragesRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };

  app.get('/students/:studentId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentAverageParamsSchema, request.params);
    const query = parseWithSchema(studentAverageQuerySchema, request.query);

    return academicAveragesService.getStudentAverages({
      institutionId,
      studentId: params.studentId,
      year: query.year,
    });
  });
}
