import type {
  CreateAssignmentBody,
  CreateEventBody,
  CreateMessageBody,
  ListWorkflowQuery,
  UpdateAssignmentBody,
} from '../schemas/workflow.schemas.js';
import {
  WorkflowsRepository,
  type AssignmentRecord,
  type MessageRecord,
  type SchoolEventRecord,
  type WorkflowRole,
} from '../infrastructure/workflows.repository.js';

export class WorkflowsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'WorkflowsServiceError';
  }
}

export class WorkflowsService {
  constructor(private readonly workflowsRepository: WorkflowsRepository) {}

  async listAssignments(input: ListWorkflowQuery & {
    institutionId: string;
    role: WorkflowRole;
    userId: string;
  }) {
    const result = await this.workflowsRepository.listAssignments(input);

    return {
      data: result.items.map((assignment) =>
        this.toAssignmentResponse(assignment)
      ),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async createAssignment(input: CreateAssignmentBody & {
    institutionId: string;
    role: WorkflowRole;
    userId: string;
  }) {
    if (input.role === 'parent') {
      throw new WorkflowsServiceError('Parents cannot create assignments', 403);
    }

    await this.assertClassroomAccess({
      institutionId: input.institutionId,
      classroomId: input.classroomId,
      role: input.role,
      userId: input.userId,
      allowSchoolWideForTeacher: false,
    });

    const created = await this.workflowsRepository.createAssignment({
      institutionId: input.institutionId,
      userId: input.userId,
      classroomId: input.classroomId,
      title: input.title.trim(),
      type: input.type,
      status: input.status,
      dueDate: input.dueDate,
    });

    if (!created) {
      throw new WorkflowsServiceError('Assignment could not be created', 500);
    }

    const assignment = await this.workflowsRepository.findAssignment(
      input.institutionId,
      created.id
    );

    if (!assignment) {
      throw new WorkflowsServiceError('Assignment not found', 404);
    }

    await this.workflowsRepository.createNotification({
      institutionId: input.institutionId,
      eventName: 'assignment.created',
      title: 'Assignment created',
      message: assignment.title,
      metadata: {
        audience: ['admin', 'teacher', 'parent'],
        classroomIds: assignment.classroomId ? [assignment.classroomId] : [],
        assignmentId: assignment.id,
      },
    });

    return {
      data: this.toAssignmentResponse(assignment),
    };
  }

  async updateAssignment(input: UpdateAssignmentBody & {
    institutionId: string;
    assignmentId: string;
    role: WorkflowRole;
    userId: string;
  }) {
    if (input.role === 'parent') {
      throw new WorkflowsServiceError('Parents cannot update assignments', 403);
    }

    const existing = await this.workflowsRepository.findAssignment(
      input.institutionId,
      input.assignmentId
    );

    if (!existing) {
      throw new WorkflowsServiceError('Assignment not found', 404);
    }

    await this.assertClassroomAccess({
      institutionId: input.institutionId,
      classroomId: existing.classroomId ?? undefined,
      role: input.role,
      userId: input.userId,
      allowSchoolWideForTeacher: false,
    });
    await this.assertClassroomAccess({
      institutionId: input.institutionId,
      classroomId: input.classroomId,
      role: input.role,
      userId: input.userId,
      allowSchoolWideForTeacher: false,
    });

    const updated = await this.workflowsRepository.updateAssignment({
      institutionId: input.institutionId,
      assignmentId: input.assignmentId,
      classroomId: input.classroomId,
      title: input.title?.trim(),
      type: input.type,
      status: input.status,
      dueDate: input.dueDate,
    });

    if (!updated) {
      throw new WorkflowsServiceError('Assignment not found', 404);
    }

    const assignment = await this.workflowsRepository.findAssignment(
      input.institutionId,
      input.assignmentId
    );

    if (!assignment) {
      throw new WorkflowsServiceError('Assignment not found', 404);
    }

    return {
      data: this.toAssignmentResponse(assignment),
    };
  }

  async listEvents(input: ListWorkflowQuery & {
    institutionId: string;
    role: WorkflowRole;
    userId: string;
  }) {
    const result = await this.workflowsRepository.listEvents(input);

    return {
      data: result.items.map((event) => this.toEventResponse(event)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async createEvent(input: CreateEventBody & {
    institutionId: string;
    role: WorkflowRole;
    userId: string;
  }) {
    if (input.role === 'parent') {
      throw new WorkflowsServiceError('Parents cannot create events', 403);
    }

    await this.assertClassroomAccess({
      institutionId: input.institutionId,
      classroomId: input.classroomId ?? undefined,
      role: input.role,
      userId: input.userId,
      allowSchoolWideForTeacher: false,
    });

    const created = await this.workflowsRepository.createEvent({
      institutionId: input.institutionId,
      userId: input.userId,
      classroomId: input.classroomId ?? undefined,
      title: input.title.trim(),
      eventType: input.eventType.trim(),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    if (!created) {
      throw new WorkflowsServiceError('Event could not be created', 500);
    }

    const event = await this.workflowsRepository.findEvent(
      input.institutionId,
      created.id
    );

    if (!event) {
      throw new WorkflowsServiceError('Event not found', 404);
    }

    await this.workflowsRepository.createNotification({
      institutionId: input.institutionId,
      eventName: event.eventType === 'exam' ? 'exam.scheduled' : 'event.created',
      title: event.eventType === 'exam' ? 'Exam scheduled' : 'Event created',
      message: event.title,
      metadata: {
        audience: ['admin', 'teacher', 'parent'],
        classroomIds: event.classroomId ? [event.classroomId] : [],
        eventId: event.id,
      },
    });

    return {
      data: this.toEventResponse(event),
    };
  }

  async listMessages(input: ListWorkflowQuery & {
    institutionId: string;
    userId: string;
  }) {
    const result = await this.workflowsRepository.listMessages(input);

    return {
      data: result.items.map((message) => this.toMessageResponse(message)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async createMessage(input: CreateMessageBody & {
    institutionId: string;
    userId: string;
  }) {
    const recipient = await this.workflowsRepository.findUserRole(
      input.institutionId,
      input.recipientUserId
    );

    if (!recipient) {
      throw new WorkflowsServiceError('Message recipient not found', 404);
    }

    const created = await this.workflowsRepository.createThreadWithMessage({
      institutionId: input.institutionId,
      userId: input.userId,
      recipientUserId: input.recipientUserId,
      subject: input.subject.trim(),
      body: input.body.trim(),
    });

    if (!created) {
      throw new WorkflowsServiceError('Message could not be created', 500);
    }

    const message = await this.workflowsRepository.findMessage(
      input.institutionId,
      created.id
    );

    if (!message) {
      throw new WorkflowsServiceError('Message not found', 404);
    }

    await this.workflowsRepository.createNotification({
      institutionId: input.institutionId,
      eventName: 'message.received',
      title: 'Message received',
      message: input.subject.trim(),
      metadata: {
        audience: [recipient.role],
        recipientUserId: input.recipientUserId,
        messageId: message.id,
      },
    });

    return {
      data: this.toMessageResponse(message),
    };
  }

  async markMessageRead(input: {
    institutionId: string;
    messageId: string;
    userId: string;
  }) {
    const updated = await this.workflowsRepository.markMessageRead(input);

    if (!updated) {
      throw new WorkflowsServiceError('Message not found', 404);
    }

    const message = await this.workflowsRepository.findMessage(
      input.institutionId,
      input.messageId
    );

    if (!message) {
      throw new WorkflowsServiceError('Message not found', 404);
    }

    return {
      data: this.toMessageResponse(message),
    };
  }

  private async assertClassroomAccess(input: {
    institutionId: string;
    classroomId?: string | null;
    role: WorkflowRole;
    userId: string;
    allowSchoolWideForTeacher: boolean;
  }) {
    if (!input.classroomId) {
      if (input.role === 'teacher' && !input.allowSchoolWideForTeacher) {
        throw new WorkflowsServiceError('Classroom is required for teachers', 403);
      }

      return;
    }

    const classroom = await this.workflowsRepository.findClassroom(
      input.institutionId,
      input.classroomId
    );

    if (!classroom) {
      throw new WorkflowsServiceError('Classroom not found', 404);
    }

    if (input.role === 'teacher') {
      const assigned =
        await this.workflowsRepository.isTeacherAssignedToClassroom({
          institutionId: input.institutionId,
          teacherUserId: input.userId,
          classroomId: input.classroomId,
        });

      if (!assigned) {
        throw new WorkflowsServiceError(
          'Teacher is not assigned to this classroom',
          403
        );
      }
    }
  }

  private toAssignmentResponse(assignment: AssignmentRecord) {
    return {
      id: assignment.id,
      institutionId: assignment.institutionId,
      classroomId: assignment.classroomId,
      classroomName: assignment.classroomName,
      createdByUserId: assignment.createdByUserId,
      title: assignment.title,
      type: assignment.type,
      status: assignment.status,
      dueDate: assignment.dueDate,
      createdAt: assignment.createdAt,
    };
  }

  private toEventResponse(event: SchoolEventRecord) {
    return {
      id: event.id,
      institutionId: event.institutionId,
      classroomId: event.classroomId,
      classroomName: event.classroomName,
      createdByUserId: event.createdByUserId,
      title: event.title,
      eventType: event.eventType,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      createdAt: event.createdAt,
    };
  }

  private toMessageResponse(message: MessageRecord) {
    return {
      id: message.id,
      institutionId: message.institutionId,
      threadId: message.threadId,
      subject: message.subject,
      senderUserId: message.senderUserId,
      recipientUserId: message.recipientUserId,
      body: message.body,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }
}
