import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  WorkflowsService,
  WorkflowsServiceError,
} from '../modules/workflows/application/workflows.service.js';
import {
  WorkflowsRepository,
  type WorkflowRole,
} from '../modules/workflows/infrastructure/workflows.repository.js';
import {
  assignmentParamsSchema,
  createAssignmentBodySchema,
  createEventBodySchema,
  createMessageBodySchema,
  institutionHeaderSchema,
  listWorkflowQuerySchema,
  messageParamsSchema,
  updateAssignmentBodySchema,
} from '../modules/workflows/schemas/workflow.schemas.js';

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
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const staffAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher'])],
  };

  app.get('/assignments', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listWorkflowQuerySchema, request.query);
    const user = getAuthenticatedUser(request);

    return workflowsService.listAssignments({
      institutionId,
      role: user.role as WorkflowRole,
      userId: user.id,
      ...query,
    });
  });

  app.post('/assignments', staffAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createAssignmentBodySchema, request.body);
    const user = getAuthenticatedUser(request);
    const result = await workflowsService.createAssignment({
      institutionId,
      role: user.role as WorkflowRole,
      userId: user.id,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/assignments/:assignmentId', staffAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(assignmentParamsSchema, request.params);
    const body = parseWithSchema(updateAssignmentBodySchema, request.body);
    const user = getAuthenticatedUser(request);

    return workflowsService.updateAssignment({
      institutionId,
      assignmentId: params.assignmentId,
      role: user.role as WorkflowRole,
      userId: user.id,
      ...body,
    });
  });

  app.get('/school-events', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listWorkflowQuerySchema, request.query);
    const user = getAuthenticatedUser(request);

    return workflowsService.listEvents({
      institutionId,
      role: user.role as WorkflowRole,
      userId: user.id,
      ...query,
    });
  });

  app.post('/school-events', staffAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createEventBodySchema, request.body);
    const user = getAuthenticatedUser(request);
    const result = await workflowsService.createEvent({
      institutionId,
      role: user.role as WorkflowRole,
      userId: user.id,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.get('/messages', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listWorkflowQuerySchema, request.query);
    const user = getAuthenticatedUser(request);

    return workflowsService.listMessages({
      institutionId,
      userId: user.id,
      ...query,
    });
  });

  app.post('/messages', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createMessageBodySchema, request.body);
    const user = getAuthenticatedUser(request);
    const result = await workflowsService.createMessage({
      institutionId,
      userId: user.id,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/messages/:messageId/read', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(messageParamsSchema, request.params);
    const user = getAuthenticatedUser(request);

    return workflowsService.markMessageRead({
      institutionId,
      messageId: params.messageId,
      userId: user.id,
    });
  });
}
