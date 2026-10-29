import type { EventBus } from '@edunic/source/events';
import {
  generateTemporaryPassword,
  hashPassword,
} from '@edunic/source/domain/auth';
import { createEnrollmentCreatedEvent } from '@edunic/source/domain/events';
import {
  buildCursorPage,
  insertOutboxEvent,
  markOutboxPublished,
  type DbExecutor,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateStudentBody,
  ListStudentsQuery,
  RegisterStudentBody,
  UpdateStudentBody,
} from '../schemas/student.schemas.js';
import type {
  AccessService,
  ReadActor,
} from '@edunic/source/domain/authorization';
import {
  StudentsRepository,
  type StudentContextRecord,
  type StudentRecord,
} from '../infrastructure/students.repository.js';

export const NO_ACTIVE_PERIOD_MESSAGE =
  'No hay un período académico activo. Créelo en Períodos académicos.';

type DatabaseError = Error & {
  code?: string;
  cause?: {
    code?: string;
  };
};

type GuardianAccount = {
  userId: string;
  created: boolean;
  temporaryPassword?: string;
};

export class StudentsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'StudentsServiceError';
  }
}

export class StudentsService {
  constructor(
    private readonly studentsRepository: StudentsRepository,
    private readonly access: AccessService,
    private readonly eventBus?: EventBus
  ) {}

  async listStudents(
    input: ListStudentsQuery & {
      actor: ReadActor;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const { actor, ...query } = input;
    const readable = await this.access.resolveReadableStudents(actor);
    const result = await this.studentsRepository.list({
      ...query,
      studentIds: readable.all ? undefined : readable.studentIds,
      search: input.search?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        sortKey: (student) => [student.firstLastName, student.firstName],
        id: (student) => student.id,
      },
      result.total
    );
    const contexts = await this.loadContexts(page.data);

    return {
      data: page.data.map((student) => ({
        ...this.toStudentResponse(student),
        ...this.toContextResponse(contexts.get(student.id)),
      })),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getStudent(studentId: string, actor: ReadActor) {
    await this.access.assertCanReadStudent(actor, studentId);

    const student = await this.studentsRepository.findById(studentId);

    if (!student) {
      throw new StudentsServiceError('Student not found', 404);
    }

    const contexts = await this.loadContexts([student]);

    return {
      data: {
        ...this.toStudentResponse(student),
        ...this.toContextResponse(contexts.get(student.id)),
      },
    };
  }

  async createStudent(input: CreateStudentBody) {
    const student = await this.studentsRepository.create({
      firstName: input.firstName.trim(),
      secondName: input.secondName?.trim() || null,
      firstLastName: input.firstLastName.trim(),
      secondLastName: input.secondLastName.trim(),
      dateOfBirth: input.dateOfBirth?.trim() || null,
    });

    return {
      data: this.toStudentResponse(student),
    };
  }

  // One transaction: student, guardians (reused by email), their parent
  // accounts, the enrollment in the active period and its outbox event. Any
  // refusal rolls every row back.
  async registerStudent(input: RegisterStudentBody) {
    try {
      return await this.studentsRepository.transaction(async (tx) => {
        const classroom = await this.studentsRepository.findClassroom(
          input.classroomId,
          tx
        );

        if (!classroom) {
          throw new StudentsServiceError('El grado seleccionado no existe.', 404);
        }

        const academicPeriod =
          await this.studentsRepository.findActiveAcademicPeriod(tx);

        if (!academicPeriod) {
          throw new StudentsServiceError(NO_ACTIVE_PERIOD_MESSAGE, 409);
        }

        const student = await this.studentsRepository.create(
          {
            firstName: input.firstName,
            secondName: input.secondName ?? null,
            firstLastName: input.firstLastName,
            secondLastName: input.secondLastName,
            dateOfBirth: input.dateOfBirth,
          },
          tx
        );

        const guardians = [];

        for (const guardianInput of input.guardians) {
          const guardian =
            (await this.studentsRepository.findGuardianByEmail(
              guardianInput.email,
              tx
            )) ??
            (await this.studentsRepository.createGuardian(guardianInput, tx));

          await this.studentsRepository.linkGuardian(student.id, guardian.id, tx);

          const account = await this.ensureParentAccount(
            guardian.id,
            guardianInput.email,
            tx
          );

          guardians.push({
            id: guardian.id,
            name: guardian.name,
            email: guardian.email ?? guardianInput.email,
            account,
          });
        }

        const enrollmentId = await this.studentsRepository.createEnrollment(
          {
            studentId: student.id,
            academicPeriodId: academicPeriod.id,
            classroomId: classroom.id,
          },
          tx
        );

        const event = createEnrollmentCreatedEvent({
          payload: {
            enrollmentId,
            studentId: student.id,
            academicPeriodId: academicPeriod.id,
            classroomId: classroom.id,
          },
        });

        await insertOutboxEvent(tx, event);

        if (this.eventBus) {
          await this.eventBus.publish(event);
          await markOutboxPublished(tx, event.id);
        }

        return {
          data: {
            student: {
              id: student.id,
              firstName: student.firstName,
              secondName: student.secondName,
              firstLastName: student.firstLastName,
              secondLastName: student.secondLastName,
              fullName: composeFullName(student),
              dateOfBirth: student.dateOfBirth,
              age: ageOn(student.dateOfBirth),
            },
            guardians,
            enrollment: {
              id: enrollmentId,
              academicPeriodId: academicPeriod.id,
              classroomId: classroom.id,
              classroom,
            },
            academicPeriod,
          },
        };
      });
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async updateStudent(input: UpdateStudentBody & { studentId: string }) {
    const existingStudent = await this.studentsRepository.findById(
      input.studentId
    );

    if (!existingStudent) {
      throw new StudentsServiceError('Student not found', 404);
    }

    const updatedStudent = await this.studentsRepository.update({
      studentId: input.studentId,
      firstName: input.firstName?.trim(),
      secondName:
        input.secondName === undefined
          ? undefined
          : input.secondName?.trim() || null,
      firstLastName: input.firstLastName?.trim(),
      secondLastName: input.secondLastName?.trim(),
      dateOfBirth:
        input.dateOfBirth === undefined
          ? undefined
          : input.dateOfBirth.trim() || null,
    });

    if (!updatedStudent) {
      throw new StudentsServiceError('Student not found', 404);
    }

    return {
      data: this.toStudentResponse(updatedStudent),
    };
  }

  async deleteStudent(studentId: string) {
    const student = await this.studentsRepository.findById(studentId);

    if (!student) {
      throw new StudentsServiceError('Student not found', 404);
    }

    const enrollmentCount = await this.studentsRepository.countEnrollments(studentId);

    if (enrollmentCount > 0) {
      throw new StudentsServiceError(
        'Student cannot be deleted while enrollments exist',
        409
      );
    }

    await this.studentsRepository.delete(studentId);

    return {
      data: {
        id: studentId,
        deleted: true,
      },
    };
  }

  // An existing parent account is linked as is; an account with another
  // role is refused; otherwise a parent account is created with a one-time
  // password that is returned once and never stored in clear.
  private async ensureParentAccount(
    guardianId: string,
    email: string,
    tx: DbExecutor
  ): Promise<GuardianAccount> {
    const user = await this.studentsRepository.findUserByEmail(email, tx);

    if (user) {
      if (user.role !== 'parent') {
        throw new StudentsServiceError(
          `El correo ${email} ya pertenece a un usuario que no es padre de familia.`,
          409
        );
      }

      await this.studentsRepository.linkGuardianUser(guardianId, user.id, tx);

      return { userId: user.id, created: false };
    }

    const temporaryPassword = generateTemporaryPassword();
    const userId = await this.studentsRepository.createParentUser(
      email,
      hashPassword(temporaryPassword),
      tx
    );

    await this.studentsRepository.linkGuardianUser(guardianId, userId, tx);

    return { userId, created: true, temporaryPassword };
  }

  private async loadContexts(students: StudentRecord[]) {
    const contexts = await this.studentsRepository.listContexts(
      students.map((student) => student.id)
    );

    return new Map(contexts.map((context) => [context.studentId, context]));
  }

  // Two registrations racing on the same new email collide on users.email.
  private handlePersistenceError(error: unknown): never {
    const databaseError = error as DatabaseError;

    if (databaseError?.code === '23505' || databaseError?.cause?.code === '23505') {
      throw new StudentsServiceError(
        'Uno de los correos ya fue registrado. Intente de nuevo.',
        409
      );
    }

    throw error;
  }

  private toStudentResponse(student: StudentRecord) {
    return {
      id: student.id,
      firstName: student.firstName,
      secondName: student.secondName,
      firstLastName: student.firstLastName,
      secondLastName: student.secondLastName,
      fullName: composeFullName(student),
      dateOfBirth: student.dateOfBirth,
      age: ageOn(student.dateOfBirth),
      createdAt: student.createdAt,
    };
  }

  private toContextResponse(context: StudentContextRecord | undefined) {
    return {
      academicPeriodId: context?.academicPeriodId ?? null,
      classroomId: context?.classroomId ?? null,
      gradeLevel: context?.gradeLevel ?? null,
      section: context?.section ?? null,
      guardians: context?.guardians ?? [],
    };
  }
}

// Single spaces between the parts; an absent second name or (legacy) second
// last name is skipped.
export function composeFullName(student: {
  firstName: string;
  secondName?: string | null;
  firstLastName: string;
  secondLastName?: string | null;
}) {
  return [
    student.firstName,
    student.secondName,
    student.firstLastName,
    student.secondLastName,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

// Whole years between a YYYY-MM-DD birth date and today (UTC).
export function ageOn(dateOfBirth: string | null, today = new Date()) {
  const match = dateOfBirth ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth) : null;

  if (!match) {
    return null;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const hadBirthday =
    today.getUTCMonth() + 1 > month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);

  return today.getUTCFullYear() - year - (hadBirthday ? 0 : 1);
}
