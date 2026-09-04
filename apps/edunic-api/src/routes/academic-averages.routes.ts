import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  AcademicAveragesService,
  AcademicAveragesServiceError,
  AcademicAveragesRepository,
  institutionHeaderSchema,
  studentAverageParamsSchema,
  studentAverageQuerySchema,
} from '@edunic/source/domain/academic-averages';

export async function academicAverageRoutes(app: FastifyInstance) {
  const academicAveragesService = new AcademicAveragesService(
    new AcademicAveragesRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
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
