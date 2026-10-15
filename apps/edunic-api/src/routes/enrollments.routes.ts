import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  getInstitutionId,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  EnrollmentsService,
  EnrollmentsServiceError,
  EnrollmentsRepository,
  createEnrollmentBodySchema,
  evaluatePromotionParamsSchema,
  enrollmentParamsSchema,
  listEnrollmentsQuerySchema,
  updateEnrollmentBodySchema,
} from '@edunic/source/domain/enrollments';

const ENROLLMENT_FILTER_SORT_OPTIONS = {
  filterFields: [
    'status',
    'studentId',
    'academicPeriodId',
    'classroomId',
    'createdAt',
  ],
  sortFields: ['status', 'createdAt'],
};

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

  app.get('/', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listEnrollmentsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      ENROLLMENT_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return enrollmentsService.listEnrollments({
      institutionId,
      teacherUserId: request.user?.role === 'teacher' ? request.user.id : undefined,
      ...query,
      filters,
      sort,
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
