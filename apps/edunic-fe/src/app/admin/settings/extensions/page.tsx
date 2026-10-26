'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  apiRequest,
  type ApiListResponse,
  type ApiSingleResponse,
  type Extension,
  type Institution,
} from '@/lib/api';

export default function InstitutionExtensionsPage() {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [institutionResult, extensionsResult] = await Promise.all([
        apiRequest<ApiSingleResponse<Institution>>(`/school-profile`),
        apiRequest<ApiListResponse<Extension>>('/extensions?limit=100&offset=0&sortOrder=asc'),
      ]);
      setInstitution(institutionResult.data);
      setExtensions(extensionsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las extensiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const enabledKeys = useMemo(
    () =>
      new Set(
        extensions
          .filter((extension) => extension.config !== null)
          .map((extension) => extension.key)
      ),
    [extensions]
  );

  const toggleExtension = useCallback(async (extensionKey: string, enabled: boolean) => {
    setBusyKey(extensionKey);
    setError('');

    try {
      if (enabled) {
        await apiRequest<ApiSingleResponse<Extension>>(
          `/extensions/${extensionKey}/config`,
          { method: 'DELETE' }
        );
      } else {
        await apiRequest<ApiSingleResponse<Extension>>(
          `/extensions/${extensionKey}/config`,
          { method: 'PUT', body: { config: {} } }
        );
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la extensión');
    } finally {
      setBusyKey('');
    }
  }, [loadData]);

  const columns = useMemo<DataTableColumn<Extension>[]>(
    () => [
      {
        key: 'extension',
        header: 'Extensión',
        render: (extension) => (
          <>
            <strong>{extensionLabel(extension)}</strong>
            <p className="field-help">{extension.key}</p>
          </>
        ),
      },
      {
        key: 'global',
        header: 'Registro',
        render: (extension) => (
          <span className={`badge ${extension.enabled ? 'badge-green' : 'badge-red'}`}>
            {extension.enabled ? 'disponible' : 'deshabilitada'}
          </span>
        ),
      },
      {
        key: 'institution',
        header: 'Colegio',
        render: (extension) => (
          <span className={`badge ${enabledKeys.has(extension.key) ? 'badge-blue' : ''}`}>
            {enabledKeys.has(extension.key) ? 'habilitada' : 'inactiva'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Acciones',
        align: 'right',
        render: (extension) => {
          const enabled = enabledKeys.has(extension.key);

          return (
            <div className="table-actions">
              <Button
                disabled={busyKey === extension.key || !extension.enabled}
                onClick={() => toggleExtension(extension.key, enabled)}
                variant={enabled ? 'secondary' : 'primary'}
              >
                {busyKey === extension.key ? 'Guardando…' : enabled ? 'Deshabilitar' : 'Habilitar'}
              </Button>
            </div>
          );
        },
      },
    ],
    [busyKey, enabledKeys, toggleExtension]
  );

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Extensiones del colegio</p>
          <h1 className="page-title">{institution?.name ?? 'Extensiones'}</h1>
          <p className="body-copy">
            Permite habilitar los módulos registrados para este colegio sin cambiar el estado
            global del registro.
          </p>
        </div>
        <ButtonLink href={`/admin/settings`} variant="secondary">
          Volver al colegio
        </ButtonLink>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Cargando extensiones…</div> : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="Todavía no hay extensiones registradas."
          getRowKey={(extension) => extension.key}
          rows={extensions}
        />
      ) : null}
    </AdminShell>
  );
}

const extensionLabels: Record<string, string> = {
  notifications: 'Notificaciones',
};

function extensionLabel(extension: Extension) {
  return extensionLabels[extension.key] ?? extension.name ?? extension.key;
}
