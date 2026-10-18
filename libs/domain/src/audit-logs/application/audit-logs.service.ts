import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListAuditLogsQuery } from '../schemas/audit-log.schemas.js';
import {
  AuditLogsRepository,
  type AuditLogRecord,
} from '../infrastructure/audit-logs.repository.js';

export class AuditLogsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AuditLogsServiceError';
  }
}

export class AuditLogsService {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async listAuditLogs(
    input: ListAuditLogsQuery & {
      institutionId: string;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.auditLogsRepository.list(input);

    const page = buildCursorPage(
      result.items,
      input,
      {
        // created_at is always set by defaultNow(); the column is typed nullable.
        sortKey: (auditLog) => auditLog.createdAt as Date,
        id: (auditLog) => auditLog.id,
      },
      result.total
    );

    return {
      data: page.data.map((auditLog) => this.toAuditLogResponse(auditLog)),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  private toAuditLogResponse(auditLog: AuditLogRecord) {
    return {
      id: auditLog.id,
      institutionId: auditLog.institutionId,
      userId: auditLog.userId,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
    };
  }
}
