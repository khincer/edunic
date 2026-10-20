import { AccessService } from '@edunic/source/domain/authorization';
import {
  PaymentsRepository,
  type PaymentRecord,
  type StudentBalanceRow,
} from '../infrastructure/payments.repository.js';
import type {
  CreatePaymentBody,
  ListPaymentsQuery,
  UpdatePaymentBody,
} from '../schemas/payment.schemas.js';

export class PaymentsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'PaymentsServiceError';
  }
}

export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly access: AccessService
  ) {}

  // The ledger as the caller may see it: an admin sees every payment, a
  // parent the ones of their own children.
  async listPayments(
    input: ListPaymentsQuery,
    actor: { role: string; userId: string }
  ) {
    const studentIds =
      actor.role === 'parent'
        ? await this.access.listParentStudentIds(actor.userId)
        : undefined;

    if (actor.role === 'parent' && studentIds?.length === 0) {
      return { data: [], meta: { total: 0, limit: input.limit, offset: input.offset } };
    }

    const result = await this.paymentsRepository.list({
      studentIds,
      studentId: input.studentId,
      status: input.status,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      data: result.items.map((payment) => this.toPaymentResponse(payment)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async getPayment(paymentId: string, actor: { role: string; userId: string }) {
    const payment = await this.paymentsRepository.findById(paymentId);

    if (!payment) {
      throw new PaymentsServiceError('Payment not found', 404);
    }

    if (actor.role === 'parent') {
      await this.access.assertParentOwnsStudent(actor.userId, payment.studentId);
    }

    return {
      data: this.toPaymentResponse(payment),
    };
  }

  async createPayment(input: CreatePaymentBody, actorUserId: string) {
    const student = await this.paymentsRepository.studentExists(input.studentId);

    if (!student) {
      throw new PaymentsServiceError('Student not found', 404);
    }

    const paidAt = input.status === 'paid' ? new Date().toISOString() : null;

    const payment = await this.paymentsRepository.create({
      studentId: input.studentId,
      concept: input.concept.trim(),
      amountCents: input.amountCents,
      dueDate: input.dueDate ?? null,
      method: input.method.trim(),
      status: input.status,
      paidAt,
      recordedByUserId: actorUserId,
      note: input.note ?? null,
    });

    if (!payment) {
      throw new PaymentsServiceError('Payment could not be created', 500);
    }

    return {
      data: this.toPaymentResponse(payment),
    };
  }

  async updatePayment(paymentId: string, input: UpdatePaymentBody) {
    const existing = await this.paymentsRepository.findById(paymentId);

    if (!existing) {
      throw new PaymentsServiceError('Payment not found', 404);
    }

    // A payment that becomes paid gets its date; one that stops being paid
    // loses it. The database keeps the two in step.
    let paidAt: string | null | undefined;

    if (input.paidAt !== undefined) {
      paidAt = input.paidAt;
    } else if (input.status === 'paid') {
      paidAt = existing.paidAt
        ? existing.paidAt.toISOString()
        : new Date().toISOString();
    } else if (input.status !== undefined) {
      paidAt = null;
    }

    const payment = await this.paymentsRepository.update(paymentId, {
      concept: input.concept?.trim(),
      amountCents: input.amountCents,
      dueDate: input.dueDate,
      method: input.method?.trim(),
      status: input.status,
      paidAt,
      note: input.note,
    });

    if (!payment) {
      throw new PaymentsServiceError('Payment not found', 404);
    }

    return {
      data: this.toPaymentResponse(payment),
    };
  }

  // The receipt of a payment: the payment, the student and the school.
  async getPaymentReceipt(
    paymentId: string,
    actor: { role: string; userId: string }
  ) {
    const receipt = await this.paymentsRepository.findReceiptContext(paymentId);

    if (!receipt) {
      throw new PaymentsServiceError('Payment not found', 404);
    }

    if (actor.role === 'parent') {
      await this.access.assertParentOwnsStudent(actor.userId, receipt.studentId);
    }

    return {
      data: {
        receiptNumber: receipt.receiptNumber,
        concept: receipt.concept,
        amountCents: receipt.amountCents,
        dueDate: receipt.dueDate,
        paidAt: receipt.paidAt,
        method: receipt.method,
        status: receipt.status,
        note: receipt.note,
        issuedAt: receipt.createdAt,
        student: {
          id: receipt.studentId,
          fullName: receipt.studentName,
        },
        school: {
          name: receipt.schoolName,
          senderName: receipt.schoolSenderName,
          replyToEmail: receipt.schoolReplyToEmail,
        },
      },
    };
  }

  // What every student owes and what is late.
  async listStudentBalances() {
    const balances = await this.paymentsRepository.listStudentBalances(
      new Date()
    );

    return {
      data: balances.map((balance) => this.toBalanceResponse(balance)),
    };
  }

  private toPaymentResponse(payment: PaymentRecord) {
    return {
      id: payment.id,
      studentId: payment.studentId,
      concept: payment.concept,
      amountCents: payment.amountCents,
      dueDate: payment.dueDate,
      paidAt: payment.paidAt,
      method: payment.method,
      status: payment.status,
      receiptNumber: payment.receiptNumber,
      recordedByUserId: payment.recordedByUserId,
      note: payment.note,
      createdAt: payment.createdAt,
    };
  }

  private toBalanceResponse(balance: StudentBalanceRow) {
    return {
      studentId: balance.studentId,
      studentName: balance.studentName,
      billedCents: balance.billedCents,
      paidCents: balance.paidCents,
      outstandingCents: balance.billedCents - balance.paidCents,
      overdueCount: balance.overdueCount,
    };
  }
}
