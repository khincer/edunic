'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useSchool } from '@/lib/school';
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
  const { school } = useSchool();
  const schoolId = school?.id ?? '';
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!schoolId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [institutionResult, logsResult] = await Promise.all([
          apiRequest<ApiSingleResponse<Institution>>(`/school-profile`),
          apiRequest<ApiListResponse<AuditLog>>(
            `/audit-logs?limit=${PAGE_SIZE}&offset=${offset}&sortOrder=desc`,
          ),
        ]);
        setInstitution(institutionResult.data);
        setLogs(logsResult.data);
        setTotal(logsResult.meta.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los registros de auditoría');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [schoolId, offset]);

  const columns = useMemo<DataTableColumn<AuditLog>[]>(
    () => [
      {
        key: 'action',
        header: 'Acción',
        render: (log) => <span className="badge badge-blue">{log.action}</span>,
      },
      {
        key: 'entity',
        header: 'Entidad',
        render: (log) => (
          <>
            <strong>{log.entity}</strong>
            <p className="field-help">{log.entityId ?? 'Sin identificador de entidad'}</p>
          </>
        ),
      },
      {
        key: 'user',
        header: 'Usuario',
        render: (log) => log.userId ?? 'Sistema',
      },
      {
        key: 'created',
        header: 'Creado',
        render: (log) => formatDate(log.createdAt),
      },
    ],
    []
  );

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuración del colegio</p>
          <h1 className="page-title">Registro de auditoría</h1>
          <p className="body-copy">
            Todas las altas, modificaciones y eliminaciones registradas para{' '}
            {institution?.name ?? 'el colegio'}.
          </p>
        </div>
        <ButtonLink href={`/admin/settings`} variant="secondary">
          Volver a configuración
        </ButtonLink>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Cargando registros de auditoría…</div> : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="Todavía no se han registrado entradas de auditoría para este colegio."
          getRowKey={(log) => log.id}
          rows={logs}
        />
      ) : null}

      <div className="page-header pager-row">
        <p className="field-help">
          Mostrando {logs.length} de {total} entradas de auditoría
        </p>
        <div className="button-row">
          <Button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            variant="secondary"
          >
            Anterior
          </Button>
          <Button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            variant="secondary"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
