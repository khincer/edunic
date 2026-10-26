import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  WorkflowsService,
  WorkflowsServiceError,
  WorkflowsRepository,
  listWorkflowQuerySchema,
  assignmentParamsSchema,
  createAssignmentBodySchema,
  updateAssignmentBodySchema,
  eventParamsSchema,
  createEventBodySchema,
  messageParamsSchema,
  createMessageBodySchema,
} from '@edunic/source/domain/workflows';
import { adminAnd, toAudienceRole } from '@edunic/source/domain/authorization';

// created_at is the only filterable/sortable column shared by assignments,
// school-events and messages (they share listWorkflowQuerySchema).
const WORKFLOW_FILTER_SORT_OPTIONS = {
  filterFields: ['createdAt'],
  sortFields: ['createdAt'],
};

function getAuthenticatedUser(request: FastifyRequest) {
  if (!request.user) {
    throw new WorkflowsServiceError('Authentication is required', 401);
  }

  return request.user;
}

export async function workflowRoutes(app: FastifyInstance) {
  const workflowsService = new WorkflowsService(
    new WorkflowsRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };
  const staffAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher'))],
  };

  app.get('/assignments', readAccess, async (request, reply) => {
    const query = parseWithSchema(listWorkflowQuerySchema, request.query);
    const user = getAuthenticatedUser(request);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      WORKFLOW_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return workflowsService.listAssignments({
      role: toAudienceRole(user.role),
      userId: user.id,
      ...query,
      filters,
      sort,
    });
  });

  app.post('/assignments', staffAccess, async (request, reply) => {
    const body = parseWithSchema(createAssignmentBodySchema, request.body);
    const user = getAuthenticatedUser(request);
    const result = await workflowsService.createAssignment({
      role: toAudienceRole(user.role),
      userId: user.id,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/assignments/:assignmentId', staffAccess, async (request) => {
    const params = parseWithSchema(assignmentParamsSchema, request.params);
    const body = parseWithSchema(updateAssignmentBodySchema, request.body);
    const user = getAuthenticatedUser(request);

    return workflowsService.updateAssignment({
      assignmentId: params.assignmentId,
      role: toAudienceRole(user.role),
      userId: user.id,
      ...body,
    });
  });

  app.get('/school-events', readAccess, async (request, reply) => {
    const query = parseWithSchema(listWorkflowQuerySchema, request.query);
    const user = getAuthenticatedUser(request);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      WORKFLOW_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return workflowsService.listEvents({
      role: toAudienceRole(user.role),
      userId: user.id,
      ...query,
      filters,
      sort,
    });
  });

  app.post('/school-events', staffAccess, async (request, reply) => {
    const body = parseWithSchema(createEventBodySchema, request.body);
    const user = getAuthenticatedUser(request);
    const result = await workflowsService.createEvent({
      role: toAudienceRole(user.role),
      userId: user.id,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.get('/messages', readAccess, async (request, reply) => {
    const query = parseWithSchema(listWorkflowQuerySchema, request.query);
    const user = getAuthenticatedUser(request);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      WORKFLOW_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return workflowsService.listMessages({
      userId: user.id,
      ...query,
      filters,
      sort,
    });
  });

  app.post('/messages', readAccess, async (request, reply) => {
    const body = parseWithSchema(createMessageBodySchema, request.body);
    const user = getAuthenticatedUser(request);
    const result = await workflowsService.createMessage({
      userId: user.id,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/messages/:messageId/read', readAccess, async (request) => {
    const params = parseWithSchema(messageParamsSchema, request.params);
    const user = getAuthenticatedUser(request);

    return workflowsService.markMessageRead({
      messageId: params.messageId,
      userId: user.id,
    });
  });
}
