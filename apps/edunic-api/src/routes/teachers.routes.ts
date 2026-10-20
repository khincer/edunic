import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';
import {
  TeachersService,
  TeachersRepository,
  assignClassroomsBodySchema,
  createTeacherBodySchema,
  listTeachersQuerySchema,
  teacherClassroomParamsSchema,
  teacherParamsSchema,
  updateTeacherRoleBodySchema,
} from '@edunic/source/domain/teachers';
import { AppError, parseWithSchema } from '@edunic/source/domain/shared';

// A teacher may read their own record; an admin may read anyone's.
const selfOrAdmin: preHandlerHookHandler = async (request: FastifyRequest) => {
  const user = request.user;

  if (!user) {
    throw new AppError('Authentication is required', 401);
  }

  if (user.role === 'admin') {
    return;
  }

  const params = parseWithSchema(teacherParamsSchema, request.params);

  if (user.id !== params.userId) {
    throw new AppError(
      'You do not have permission to perform this action',
      403
    );
  }
};

export async function teacherRoutes(app: FastifyInstance) {
  const teachersService = new TeachersService(new TeachersRepository(app.db));
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };
  const selfOrAdminAccess = {
    preHandler: [app.authenticate, selfOrAdmin],
  };

  app.get('/', adminOnly, async (request) => {
    const query = parseWithSchema(listTeachersQuerySchema, request.query);

    return teachersService.listTeachers(query);
  });

  app.post('/', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createTeacherBodySchema, request.body);
    const result = await teachersService.createTeacher(
      body,
      request.user?.institutionId ?? ''
    );

    return reply.status(201).send(result);
  });

  app.get('/:userId', selfOrAdminAccess, async (request) => {
    const params = parseWithSchema(teacherParamsSchema, request.params);

    return teachersService.getTeacher(params.userId);
  });

  app.patch('/:userId/role', adminOnly, async (request) => {
    const params = parseWithSchema(teacherParamsSchema, request.params);
    const body = parseWithSchema(updateTeacherRoleBodySchema, request.body);

    return teachersService.updateTeacherRole(params.userId, body.role);
  });

  app.get('/:userId/classrooms', selfOrAdminAccess, async (request) => {
    const params = parseWithSchema(teacherParamsSchema, request.params);

    return teachersService.listTeacherClassrooms(params.userId);
  });

  app.post('/:userId/classrooms', adminOnly, async (request) => {
    const params = parseWithSchema(teacherParamsSchema, request.params);
    const body = parseWithSchema(assignClassroomsBodySchema, request.body);

    return teachersService.assignClassrooms(params.userId, body);
  });

  app.delete('/:userId/classrooms/:classroomId', adminOnly, async (request) => {
    const params = parseWithSchema(
      teacherClassroomParamsSchema,
      request.params
    );

    return teachersService.unassignClassroom(
      params.userId,
      params.classroomId
    );
  });
}
