import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ListNotificationsQuery } from '../schemas/notification.schemas.js';

type Database = FastifyInstance['db'];

type CountRow = {
  count: string | number;
};

export type NotificationRecord = {
  id: string;
  institutionId: string;
  eventName: string;
  title: string;
  message: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date | null;
};

export class NotificationsRepository {
  constructor(private readonly db: Database) {}

  async isNotificationsExtensionEnabled(institutionId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from institution_extensions
      inner join extensions
        on extensions.key = institution_extensions.extension_key
      where institution_extensions.institution_id = ${institutionId}
        and institution_extensions.extension_key = 'notifications'
        and coalesce(extensions.enabled, false) = true
    `);

    return this.toCount(result.rows[0]?.count) > 0;
  }

  async create(input: {
    institutionId: string;
    eventName: string;
    title: string;
    message: string;
    metadata: unknown;
  }) {
    const result = await this.db.execute<NotificationRecord>(sql`
      insert into notifications (
        institution_id,
        event_name,
        title,
        message,
        metadata
      )
      values (
        ${input.institutionId},
        ${input.eventName},
        ${input.title},
        ${input.message},
        ${JSON.stringify(input.metadata)}::jsonb
      )
      returning
        id,
        institution_id as "institutionId",
        event_name as "eventName",
        title,
        message,
        metadata,
        read_at as "readAt",
        created_at as "createdAt"
    `);

    return result.rows[0];
  }

  async list(input: ListNotificationsQuery & { institutionId: string }) {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.unreadOnly) {
      filters.push(sql`read_at is null`);
    }

    if (input.eventName) {
      filters.push(sql`event_name = ${input.eventName}`);
    }

    const whereClause = sql.join(filters, sql` and `);

    const [items, totalRows] = await Promise.all([
      this.db.execute<NotificationRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          event_name as "eventName",
          title,
          message,
          metadata,
          read_at as "readAt",
          created_at as "createdAt"
        from notifications
        where ${whereClause}
        order by created_at desc
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from notifications
        where ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async markRead(institutionId: string, notificationId: string) {
    const result = await this.db.execute<NotificationRecord>(sql`
      update notifications
      set read_at = coalesce(read_at, now())
      where id = ${notificationId}
        and institution_id = ${institutionId}
      returning
        id,
        institution_id as "institutionId",
        event_name as "eventName",
        title,
        message,
        metadata,
        read_at as "readAt",
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
