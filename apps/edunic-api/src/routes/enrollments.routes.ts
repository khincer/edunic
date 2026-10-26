import type { FastifyInstance } from 'fastify';
import {
  parseWithSchema,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  EnrollmentsService,
  EnrollmentsRepository,
  createEnrollmentBodySchema,
  evaluatePromotionParamsSchema,
  enrollmentParamsSchema,
  listEnrollmentsQuerySchema,
  updateEnrollmentBodySchema,
} from '@edunic/source/domain/enrollments';
import {
  AccessRepository,
  AccessService,
  adminAnd,
} from '@edunic/source/domain/authorization';
import { actorOf } from './actor.js';

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
    new AccessService(new AccessRepository(app.db)),
    app.eventBus
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };
  const academicWriteAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher'))],
  };

  app.get('/', readAccess, async (request, reply) => {
    const query = parseWithSchema(listEnrollmentsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      ENROLLMENT_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return enrollmentsService.listEnrollments({
      actor: actorOf(request),
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:enrollmentId', readAccess, async (request) => {
    const params = parseWithSchema(enrollmentParamsSchema, request.params);

    return enrollmentsService.getEnrollment(
      params.enrollmentId,
      actorOf(request)
    );
  });

  app.post('/', academicWriteAccess, async (request, reply) => {
    const body = parseWithSchema(createEnrollmentBodySchema, request.body);
    const result = await enrollmentsService.createEnrollment(body);

    return reply.status(201).send(result);
  });

  app.patch('/:enrollmentId', academicWriteAccess, async (request) => {
    const params = parseWithSchema(enrollmentParamsSchema, request.params);
    const body = parseWithSchema(updateEnrollmentBodySchema, request.body);

    return enrollmentsService.updateEnrollment({
      enrollmentId: params.enrollmentId,
      ...body,
    });
  });

  app.delete('/:enrollmentId', academicWriteAccess, async (request) => {
    const params = parseWithSchema(enrollmentParamsSchema, request.params);

    return enrollmentsService.deleteEnrollment(params.enrollmentId);
  });

  app.post('/:enrollmentId/promotion', academicWriteAccess, async (request) => {
    const params = parseWithSchema(
      evaluatePromotionParamsSchema,
      request.params
    );

    return enrollmentsService.evaluatePromotion(params.enrollmentId);
  });
}
