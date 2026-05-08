'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  apiRequest,
  formatDate,
  type ApiListResponse,
  type ApiSingleResponse,
  type AuditLog,
  type Institution,
} from '@/lib/api';

const PAGE_SIZE = 10;

export default function InstitutionAuditLogsPage() {
  const params = useParams<{ institutionId: string }>();
  const institutionId = params.institutionId;
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const [institutionResult, logsResult] = await Promise.all([
          apiRequest<ApiSingleResponse<Institution>>(`/institutions/${institutionId}`),
          apiRequest<ApiListResponse<AuditLog>>(
            `/audit-logs?limit=${PAGE_SIZE}&offset=${offset}&sortOrder=desc`,
            { institutionId }
          ),
        ]);
        setInstitution(institutionResult.data);
        setLogs(logsResult.data);
        setTotal(logsResult.meta.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load audit logs');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [institutionId, offset]);

  const columns = useMemo<DataTableColumn<AuditLog>[]>(
    () => [
      {
        key: 'action',
        header: 'Action',
        render: (log) => <span className="badge badge-blue">{log.action}</span>,
      },
      {
        key: 'entity',
        header: 'Entity',
        render: (log) => (
          <>
            <strong>{log.entity}</strong>
            <p className="field-help">{log.entityId ?? 'No entity id'}</p>
          </>
        ),
      },
      {
        key: 'user',
        header: 'User',
        render: (log) => log.userId ?? 'System',
      },
      {
        key: 'created',
        header: 'Created',
        render: (log) => formatDate(log.createdAt),
      },
    ],
    []
  );

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Audit logs</p>
          <h1 className="page-title">{institution?.name ?? 'Institution trail'}</h1>
          <p className="body-copy">
            Tenant-scoped create, update, and delete activity from the API audit log.
          </p>
        </div>
        <ButtonLink href={`/institutions/${institutionId}`} variant="secondary">
          Back to institution
        </ButtonLink>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Loading audit logs...</div> : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="No audit logs have been recorded for this institution."
          getRowKey={(log) => log.id}
          rows={logs}
        />
      ) : null}

      <div className="page-header" style={{ marginTop: 18 }}>
        <p className="field-help">
          Showing {logs.length} of {total} audit entries
        </p>
        <div className="button-row">
          <Button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            variant="secondary"
          >
            Previous
          </Button>
          <Button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            variant="secondary"
          >
            Next
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
