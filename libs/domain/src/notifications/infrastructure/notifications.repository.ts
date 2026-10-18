import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildFilterConditions,
  buildSortSql,
  type CursorOrderSpec,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListNotificationsQuery } from '../schemas/notification.schemas.js';

type CountRow = {
  count: string | number;
};

// Stable keyset order for cursor pagination (P2-R4): created_at desc, id desc,
// mirroring the legacy feed order (newest first). The uuid `id` closes the
// order because multiple notifications can share a created_at.
export const NOTIFICATION_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['created_at', 'id'],
  direction: 'desc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const NOTIFICATION_LIST_COLUMNS = {
  eventName: 'event_name',
  title: 'title',
  createdAt: 'created_at',
} as const;

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
  constructor(private readonly db: NodePgDatabase) {}

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

  async list(input: ListNotificationsQuery & {
    institutionId: string;
    role?: string;
    userId?: string;
    filters?: FilterSpec[];
    sort?: SortSpec | null;
  }) {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.unreadOnly) {
      filters.push(sql`read_at is null`);
    }

    if (input.eventName) {
      filters.push(sql`event_name = ${input.eventName}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], NOTIFICATION_LIST_COLUMNS)
    );

    filters.push(...this.getRoleFilters(input.role, input.userId));

    const plan = applyCursorPagination(input, NOTIFICATION_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause = sql.join(filters, sql` and `);
    const orderBy = plan.orderBy ?? this.legacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
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
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<NotificationRecord>(itemsQuery);

      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<NotificationRecord>(itemsQuery),
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

  async markRead(input: {
    institutionId: string;
    notificationId: string;
    role?: string;
    userId?: string;
  }) {
    const roleFilters = this.getRoleFilters(input.role, input.userId);
    const roleClause =
      roleFilters.length > 0
        ? sql`and ${sql.join(roleFilters, sql` and `)}`
        : sql``;
    const result = await this.db.execute<NotificationRecord>(sql`
      update notifications
      set read_at = coalesce(read_at, now())
      where id = ${input.notificationId}
        and institution_id = ${input.institutionId}
        ${roleClause}
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

  // The standard `sort` param wins over the legacy created_at desc order;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: {
    sort?: SortSpec | null;
  }): SQL {
    return (
      buildSortSql(input.sort ?? null, NOTIFICATION_LIST_COLUMNS) ??
      sql`created_at desc`
    );
  }

  private getRoleFilters(role?: string, userId?: string) {
    if (!role) {
      return [];
    }

    const filters: SQL[] = [
      sql`(
        metadata is null
        or metadata->'audience' is null
        or metadata->'audience' ? ${role}
      )`,
    ];

    if (role === 'parent' && userId) {
      filters.push(sql`
        (
          metadata->'studentIds' is null
          or exists (
            select 1
            from guardian_user_links gul
            inner join student_guardians sg
              on sg.guardian_id = gul.guardian_id
            where gul.institution_id = notifications.institution_id
              and gul.user_id = ${userId}
              and metadata->'studentIds' ? sg.student_id::text
          )
        )
      `);
    }

    if (role === 'teacher' && userId) {
      filters.push(sql`
        (
          metadata->'classroomIds' is null
          or exists (
            select 1
            from teacher_classroom_assignments tca
            where tca.institution_id = notifications.institution_id
              and tca.teacher_user_id = ${userId}
              and metadata->'classroomIds' ? tca.classroom_id::text
          )
        )
      `);
    }

    return filters;
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
