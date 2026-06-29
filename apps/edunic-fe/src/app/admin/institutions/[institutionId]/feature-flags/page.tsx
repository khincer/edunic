'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  apiRequest,
  type ApiSingleResponse,
  type FeatureFlag,
  type Institution,
} from '@/lib/api';

export default function InstitutionFeatureFlagsPage() {
  const params = useParams<{ institutionId: string }>();
  const institutionId = params.institutionId;
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [institutionResult, flagsResult] = await Promise.all([
        apiRequest<ApiSingleResponse<Institution>>(`/institutions/${institutionId}`),
        apiRequest<{ data: FeatureFlag[] }>(
          `/institutions/${institutionId}/feature-flags`
        ),
      ]);
      setInstitution(institutionResult.data);
      setFlags(flagsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load feature flags');
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setFlag = useCallback(
    async (featureKey: string, enabled: boolean) => {
      setBusyKey(featureKey);
      setError('');

      try {
        await apiRequest<ApiSingleResponse<FeatureFlag>>(
          `/institutions/${institutionId}/feature-flags/${featureKey}`,
          { method: 'PUT', body: { enabled } }
        );
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to update feature flag');
      } finally {
        setBusyKey('');
      }
    },
    [institutionId, loadData]
  );

  const resetFlag = useCallback(
    async (featureKey: string) => {
      setBusyKey(featureKey);
      setError('');

      try {
        await apiRequest<ApiSingleResponse<FeatureFlag>>(
          `/institutions/${institutionId}/feature-flags/${featureKey}`,
          { method: 'DELETE' }
        );
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to reset feature flag');
      } finally {
        setBusyKey('');
      }
    },
    [institutionId, loadData]
  );

  const columns = useMemo<DataTableColumn<FeatureFlag>[]>(
    () => [
      {
        key: 'feature',
        header: 'Feature',
        render: (flag) => (
          <>
            <strong>{formatFeatureName(flag.key)}</strong>
            <p className="field-help">{flag.key}</p>
          </>
        ),
      },
      {
        key: 'default',
        header: 'Default',
        render: (flag) => (
          <span className={`badge ${flag.defaultValue ? 'badge-green' : ''}`}>
            {flag.defaultValue ? 'on' : 'off'}
          </span>
        ),
      },
      {
        key: 'effective',
        header: 'Effective',
        render: (flag) => (
          <span className={`badge ${flag.enabled ? 'badge-blue' : 'badge-red'}`}>
            {flag.enabled ? 'enabled' : 'disabled'}
          </span>
        ),
      },
      {
        key: 'source',
        header: 'Source',
        render: (flag) => (
          <span className="badge">
            {flag.source === 'institution' ? 'school override' : 'global default'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (flag) => (
          <div className="table-actions">
            <Button
              disabled={busyKey === flag.key}
              onClick={() => setFlag(flag.key, !flag.enabled)}
              variant={flag.enabled ? 'secondary' : 'primary'}
            >
              {busyKey === flag.key ? 'Saving...' : flag.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              disabled={busyKey === flag.key || flag.source === 'default'}
              onClick={() => resetFlag(flag.key)}
              variant="ghost"
            >
              Reset
            </Button>
          </div>
        ),
      },
    ],
    [busyKey, resetFlag, setFlag]
  );

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Feature flags</p>
          <h1 className="page-title">{institution?.name ?? 'Feature flags'}</h1>
          <p className="body-copy">
            Control staged product capabilities for this school without changing
            global defaults.
          </p>
        </div>
        <ButtonLink href={`/admin/institutions/${institutionId}`} variant="secondary">
          Back to institution
        </ButtonLink>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Loading feature flags...</div> : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="No feature flags are registered yet."
          getRowKey={(flag) => flag.key}
          rows={flags}
        />
      ) : null}
    </AdminShell>
  );
}

function formatFeatureName(key: string) {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
