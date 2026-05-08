'use client';

import { useParams } from 'next/navigation';
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
  type InstitutionExtension,
} from '@/lib/api';

export default function InstitutionExtensionsPage() {
  const params = useParams<{ institutionId: string }>();
  const institutionId = params.institutionId;
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [enabledExtensions, setEnabledExtensions] = useState<InstitutionExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [institutionResult, extensionsResult, enabledResult] = await Promise.all([
        apiRequest<ApiSingleResponse<Institution>>(`/institutions/${institutionId}`),
        apiRequest<ApiListResponse<Extension>>('/extensions?limit=100&offset=0&sortOrder=asc'),
        apiRequest<ApiSingleResponse<InstitutionExtension[]> | { data: InstitutionExtension[] }>(
          `/institutions/${institutionId}/extensions`
        ),
      ]);
      setInstitution(institutionResult.data);
      setExtensions(extensionsResult.data);
      setEnabledExtensions(enabledResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load extensions');
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const enabledKeys = useMemo(
    () => new Set(enabledExtensions.map((extension) => extension.extensionKey)),
    [enabledExtensions]
  );

  const toggleExtension = useCallback(async (extensionKey: string, enabled: boolean) => {
    setBusyKey(extensionKey);
    setError('');

    try {
      if (enabled) {
        await apiRequest<ApiSingleResponse<{ institutionId: string; extensionKey: string; deleted: boolean }>>(
          `/institutions/${institutionId}/extensions/${extensionKey}`,
          { method: 'DELETE' }
        );
      } else {
        await apiRequest<ApiSingleResponse<InstitutionExtension>>(
          `/institutions/${institutionId}/extensions/${extensionKey}`,
          { method: 'PUT', body: { config: {} } }
        );
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update extension');
    } finally {
      setBusyKey('');
    }
  }, [institutionId, loadData]);

  const columns = useMemo<DataTableColumn<Extension>[]>(
    () => [
      {
        key: 'extension',
        header: 'Extension',
        render: (extension) => (
          <>
            <strong>{extension.name ?? extension.key}</strong>
            <p className="field-help">{extension.key}</p>
          </>
        ),
      },
      {
        key: 'global',
        header: 'Registry',
        render: (extension) => (
          <span className={`badge ${extension.enabled ? 'badge-green' : 'badge-red'}`}>
            {extension.enabled ? 'available' : 'disabled'}
          </span>
        ),
      },
      {
        key: 'institution',
        header: 'Institution',
        render: (extension) => (
          <span className={`badge ${enabledKeys.has(extension.key) ? 'badge-blue' : ''}`}>
            {enabledKeys.has(extension.key) ? 'enabled' : 'off'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
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
                {busyKey === extension.key ? 'Saving...' : enabled ? 'Disable' : 'Enable'}
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
          <p className="eyebrow">Institution extensions</p>
          <h1 className="page-title">{institution?.name ?? 'Extensions'}</h1>
          <p className="body-copy">
            Enable registered modules for this school without changing global registry state.
          </p>
        </div>
        <ButtonLink href={`/institutions/${institutionId}`} variant="secondary">
          Back to institution
        </ButtonLink>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Loading extensions...</div> : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="No extensions are registered yet."
          getRowKey={(extension) => extension.key}
          rows={extensions}
        />
      ) : null}
    </AdminShell>
  );
}
