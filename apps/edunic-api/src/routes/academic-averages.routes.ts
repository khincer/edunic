import type { FastifyInstance } from 'fastify';
import { parseWithSchema } from '@edunic/source/domain/shared';
import {
  AcademicAveragesService,
  AcademicAveragesRepository,
  studentAverageParamsSchema,
  studentAverageQuerySchema,
} from '@edunic/source/domain/academic-averages';
import {
  AccessRepository,
  AccessService,
  adminAnd,
} from '@edunic/source/domain/authorization';
import { actorOf } from './actor.js';

export async function academicAverageRoutes(app: FastifyInstance) {
  const academicAveragesService = new AcademicAveragesService(
    new AcademicAveragesRepository(app.db),
    new AccessService(new AccessRepository(app.db))
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };

  app.get('/students/:studentId', readAccess, async (request) => {
    const params = parseWithSchema(studentAverageParamsSchema, request.params);
    const query = parseWithSchema(studentAverageQuerySchema, request.query);

    return academicAveragesService.getStudentAverages({
      studentId: params.studentId,
      year: query.year,
      actor: actorOf(request),
    });
  });
}
