import {
  SubjectsRepository,
  type SubjectRecord,
  type TopicRecord,
} from '../infrastructure/subjects.repository.js';
import type {
  AssignSubjectsBody,
  CreateSubjectBody,
  UpdateSubjectBody,
} from '../schemas/subjects.schemas.js';

export class SubjectsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'SubjectsServiceError';
  }
}

export class SubjectsService {
  constructor(private readonly subjectsRepository: SubjectsRepository) {}

  // The catalog as the actor may see it: an admin sees everything, a teacher
  // the materias assigned to them, a parent the materias their children study.
  async listSubjects(actor: { role: string; userId: string }) {
    const subjects = await this.subjectsRepository.listForActor(
      actor.role,
      actor.userId
    );

    return {
      data: subjects.map((subject) => this.toSubjectResponse(subject)),
    };
  }

  async getSubject(subjectId: string) {
    const subject = await this.subjectsRepository.findById(subjectId);

    if (!subject) {
      throw new SubjectsServiceError('Subject not found', 404);
    }

    return {
      data: this.toSubjectResponse(subject),
    };
  }

  async createSubject(input: CreateSubjectBody) {
    const subject = await this.subjectsRepository.create({
      name: input.name.trim(),
      code: input.code,
      description: input.description,
    });

    if (!subject) {
      throw new SubjectsServiceError('Subject could not be created', 500);
    }

    return {
      data: this.toSubjectResponse(subject),
    };
  }

  async updateSubject(subjectId: string, input: UpdateSubjectBody) {
    const subject = await this.subjectsRepository.update(subjectId, {
      name: input.name?.trim(),
      code: input.code,
      description: input.description,
      active: input.active,
    });

    if (!subject) {
      throw new SubjectsServiceError('Subject not found', 404);
    }

    return {
      data: this.toSubjectResponse(subject),
    };
  }

  async listTopics(subjectId: string) {
    const subject = await this.subjectsRepository.findById(subjectId);

    if (!subject) {
      throw new SubjectsServiceError('Subject not found', 404);
    }

    const topics = await this.subjectsRepository.listTopics(subjectId);

    return {
      data: topics.map((topic) => this.toTopicResponse(topic)),
    };
  }

  async createTopic(subjectId: string, name: string) {
    const subject = await this.subjectsRepository.findById(subjectId);

    if (!subject) {
      throw new SubjectsServiceError('Subject not found', 404);
    }

    const topic = await this.subjectsRepository.createTopic(
      subjectId,
      name.trim()
    );

    if (!topic) {
      throw new SubjectsServiceError('Topic could not be created', 500);
    }

    return {
      data: this.toTopicResponse(topic),
    };
  }

  async updateTopic(topicId: string, name: string) {
    const topic = await this.subjectsRepository.updateTopic(topicId, name.trim());

    if (!topic) {
      throw new SubjectsServiceError('Topic not found', 404);
    }

    return {
      data: this.toTopicResponse(topic),
    };
  }

  // Which materias a grade level offers.
  async listClassroomSubjects(classroomId: string) {
    const subjects = await this.subjectsRepository.listClassroomSubjects(
      classroomId
    );

    return {
      data: subjects.map((subject) => this.toSubjectResponse(subject)),
    };
  }

  async assignClassroomSubjects(
    classroomId: string,
    input: AssignSubjectsBody
  ) {
    for (const subjectId of input.subjectIds) {
      const subject = await this.subjectsRepository.findById(subjectId);

      if (!subject) {
        throw new SubjectsServiceError('Subject not found', 404);
      }
    }

    for (const subjectId of input.subjectIds) {
      await this.subjectsRepository.assignClassroomSubject(
        classroomId,
        subjectId
      );
    }

    return this.listClassroomSubjects(classroomId);
  }

  async removeClassroomSubject(classroomId: string, subjectId: string) {
    const removed = await this.subjectsRepository.removeClassroomSubject(
      classroomId,
      subjectId
    );

    if (!removed) {
      throw new SubjectsServiceError(
        'The classroom does not offer that subject',
        404
      );
    }

    return {
      data: {
        classroomId,
        subjectId,
        deleted: true,
      },
    };
  }

  // Which materias a teacher is responsible for.
  async listTeacherSubjects(teacherUserId: string) {
    const subjects = await this.subjectsRepository.listTeacherSubjects(
      teacherUserId
    );

    return {
      data: subjects.map((subject) => this.toSubjectResponse(subject)),
    };
  }

  async assignTeacherSubjects(
    teacherUserId: string,
    input: AssignSubjectsBody
  ) {
    for (const subjectId of input.subjectIds) {
      const subject = await this.subjectsRepository.findById(subjectId);

      if (!subject) {
        throw new SubjectsServiceError('Subject not found', 404);
      }
    }

    for (const subjectId of input.subjectIds) {
      await this.subjectsRepository.assignTeacherSubject(
        teacherUserId,
        subjectId
      );
    }

    return this.listTeacherSubjects(teacherUserId);
  }

  async removeTeacherSubject(teacherUserId: string, subjectId: string) {
    const removed = await this.subjectsRepository.removeTeacherSubject(
      teacherUserId,
      subjectId
    );

    if (!removed) {
      throw new SubjectsServiceError(
        'The teacher does not teach that subject',
        404
      );
    }

    return {
      data: {
        teacherUserId,
        subjectId,
        deleted: true,
      },
    };
  }

  private toSubjectResponse(subject: SubjectRecord) {
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      description: subject.description,
      active: subject.active,
      createdAt: subject.createdAt,
    };
  }

  private toTopicResponse(topic: TopicRecord) {
    return {
      id: topic.id,
      subjectId: topic.subjectId,
      name: topic.name,
      createdAt: topic.createdAt,
    };
  }
}
