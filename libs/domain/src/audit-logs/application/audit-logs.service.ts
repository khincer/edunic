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

  async listAuditLogs(input: ListAuditLogsQuery & { institutionId: string }) {
    const result = await this.auditLogsRepository.list(input);

    return {
      data: result.items.map((auditLog) => this.toAuditLogResponse(auditLog)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
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
