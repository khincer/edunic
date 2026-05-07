import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  EnrollmentsService,
  EnrollmentsServiceError,
} from '../modules/enrollments/application/enrollments.service.js';
import { EnrollmentsRepository } from '../modules/enrollments/infrastructure/enrollments.repository.js';
import {
  createEnrollmentBodySchema,
  evaluatePromotionParamsSchema,
  enrollmentParamsSchema,
  institutionHeaderSchema,
  listEnrollmentsQuerySchema,
  updateEnrollmentBodySchema,
} from '../modules/enrollments/schemas/enrollment.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new EnrollmentsServiceError(
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

export async function enrollmentRoutes(app: FastifyInstance) {
  const enrollmentsService = new EnrollmentsService(
    new EnrollmentsRepository(app.db),
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
    const query = parseWithSchema(listEnrollmentsQuerySchema, request.query);

    return enrollmentsService.listEnrollments({
      institutionId,
      ...query,
    });
  });

  app.get('/:enrollmentId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(enrollmentParamsSchema, request.params);

    return enrollmentsService.getEnrollment(institutionId, params.enrollmentId);
  });

  app.post('/', academicWriteAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createEnrollmentBodySchema, request.body);
    const result = await enrollmentsService.createEnrollment({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:enrollmentId', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(enrollmentParamsSchema, request.params);
    const body = parseWithSchema(updateEnrollmentBodySchema, request.body);

    return enrollmentsService.updateEnrollment({
      institutionId,
      enrollmentId: params.enrollmentId,
      ...body,
    });
  });

  app.delete('/:enrollmentId', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(enrollmentParamsSchema, request.params);

    return enrollmentsService.deleteEnrollment(
      institutionId,
      params.enrollmentId
    );
  });

  app.post('/:enrollmentId/promotion', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(
      evaluatePromotionParamsSchema,
      request.params
    );

    return enrollmentsService.evaluatePromotion(
      institutionId,
      params.enrollmentId
    );
  });
}
