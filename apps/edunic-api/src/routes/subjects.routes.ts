import type { FastifyInstance } from 'fastify';
import {
  SubjectsService,
  SubjectsRepository,
  assignSubjectsBodySchema,
  classroomSubjectParamsSchema,
  classroomSubjectsParamsSchema,
  createSubjectBodySchema,
  createTopicBodySchema,
  subjectParamsSchema,
  teacherSubjectParamsSchema,
  teacherSubjectsParamsSchema,
  topicParamsSchema,
  updateSubjectBodySchema,
  updateTopicBodySchema,
} from '@edunic/source/domain/subjects';
import { parseWithSchema } from '@edunic/source/domain/shared';
import { ADMIN_ROLES } from '@edunic/source/domain/authorization';

export async function subjectRoutes(app: FastifyInstance) {
  const subjectsService = new SubjectsService(new SubjectsRepository(app.db));
  const authenticated = {
    preHandler: [app.authenticate],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };

  // The catalog as the caller may see it: an admin sees every materia, a
  // teacher the ones assigned to them, a parent the ones their children study.
  app.get('/', authenticated, async (request) => {
    return subjectsService.listSubjects({
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
    });
  });

  app.post('/', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createSubjectBodySchema, request.body);
    const result = await subjectsService.createSubject(body);

    return reply.status(201).send(result);
  });

  app.patch('/:subjectId', adminOnly, async (request) => {
    const params = parseWithSchema(subjectParamsSchema, request.params);
    const body = parseWithSchema(updateSubjectBodySchema, request.body);

    return subjectsService.updateSubject(params.subjectId, body);
  });

  app.get('/:subjectId/topics', authenticated, async (request) => {
    const params = parseWithSchema(subjectParamsSchema, request.params);

    return subjectsService.listTopics(params.subjectId);
  });

  app.post('/:subjectId/topics', adminOnly, async (request, reply) => {
    const params = parseWithSchema(subjectParamsSchema, request.params);
    const body = parseWithSchema(createTopicBodySchema, request.body);
    const result = await subjectsService.createTopic(params.subjectId, body.name);

    return reply.status(201).send(result);
  });

  app.patch('/:subjectId/topics/:topicId', adminOnly, async (request) => {
    const params = parseWithSchema(topicParamsSchema, request.params);
    const body = parseWithSchema(updateTopicBodySchema, request.body);

    return subjectsService.updateTopic(params.topicId, body.name);
  });

  // Which materias a grade level offers.
  app.get('/classroom/:classroomId', authenticated, async (request) => {
    const params = parseWithSchema(
      classroomSubjectsParamsSchema,
      request.params
    );

    return subjectsService.listClassroomSubjects(params.classroomId);
  });

  app.post('/classroom/:classroomId', adminOnly, async (request) => {
    const params = parseWithSchema(
      classroomSubjectsParamsSchema,
      request.params
    );
    const body = parseWithSchema(assignSubjectsBodySchema, request.body);

    return subjectsService.assignClassroomSubjects(
      params.classroomId,
      body
    );
  });

  app.delete('/classroom/:classroomId/:subjectId', adminOnly, async (request) => {
    const params = parseWithSchema(classroomSubjectParamsSchema, request.params);

    return subjectsService.removeClassroomSubject(
      params.classroomId,
      params.subjectId
    );
  });

  // Which materias a teacher is responsible for.
  app.get('/teacher/:teacherUserId', adminOnly, async (request) => {
    const params = parseWithSchema(
      teacherSubjectsParamsSchema,
      request.params
    );

    return subjectsService.listTeacherSubjects(params.teacherUserId);
  });

  app.post('/teacher/:teacherUserId', adminOnly, async (request) => {
    const params = parseWithSchema(
      teacherSubjectsParamsSchema,
      request.params
    );
    const body = parseWithSchema(assignSubjectsBodySchema, request.body);

    return subjectsService.assignTeacherSubjects(params.teacherUserId, body);
  });

  app.delete('/teacher/:teacherUserId/:subjectId', adminOnly, async (request) => {
    const params = parseWithSchema(teacherSubjectParamsSchema, request.params);

    return subjectsService.removeTeacherSubject(
      params.teacherUserId,
      params.subjectId
    );
  });
}
