'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  apiRequest,
  buildQuery,
  formatDate,
  type ApiListResponse,
  type ApiSingleResponse,
  type EmailDelivery,
  type EmailDeliveryState,
  type EmailDeliveryStatus,
} from '@/lib/api';

const PAGE_SIZE = 25;
const STATUS_OPTIONS: Array<EmailDeliveryStatus | ''> = [
  '',
  'queued',
  'sending',
  'retried',
  'sent',
  'failed',
];

const STATUS_BADGE: Record<EmailDeliveryStatus, string> = {
  queued: 'badge badge-blue',
  sending: 'badge badge-blue',
  retried: 'badge badge-blue',
  sent: 'badge badge-green',
  failed: 'badge badge-red',
};

const STATUS_LABELS: Record<EmailDeliveryStatus, string> = {
  queued: 'En cola',
  sending: 'Enviando',
  retried: 'Reintentado',
  sent: 'Enviado',
  failed: 'Fallido',
};

// PN-R1/PN-R2/PN-R3: the delivery panel is a read-only ledger. There is no
// retry control and no endpoint behind one, and the panel stays visible while
// the `email_notifications` flag is off.
export default function EmailNotificationsPanelPage() {
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [state, setState] = useState<EmailDeliveryState | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<EmailDeliveryStatus | ''>('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPanel() {
      setLoading(true);
      setError('');

      try {
        const [stateResult, deliveriesResult] = await Promise.all([
          apiRequest<ApiSingleResponse<EmailDeliveryState>>(
            '/notifications/deliveries/state'
          ),
          apiRequest<ApiListResponse<EmailDelivery>>(
            `/notifications/deliveries${buildQuery({
              status,
              limit: PAGE_SIZE,
              offset,
            })}`
          ),
        ]);

        setState(stateResult.data);
        setDeliveries(deliveriesResult.data);
        setTotal(deliveriesResult.meta.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'No se pudieron cargar los envíos de correo'
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPanel();
  }, [offset, status]);

  const columns = useMemo<DataTableColumn<EmailDelivery>[]>(
    () => [
      {
        key: 'recipient',
        header: 'Destinatario',
        render: (delivery) => (
          <>
            <strong>{delivery.recipientAddress}</strong>
            <p className="field-help">{delivery.recipientSource}</p>
          </>
        ),
      },
      { key: 'event', header: 'Evento', render: (delivery) => delivery.eventName },
      {
        key: 'status',
        header: 'Estado',
        render: (delivery) => (
          <span className={STATUS_BADGE[delivery.status]}>{STATUS_LABELS[delivery.status]}</span>
        ),
      },
      {
        key: 'attempts',
        header: 'Intentos',
        align: 'right',
        render: (delivery) => delivery.attemptCount,
      },
      {
        key: 'provider',
        header: 'Proveedor',
        render: (delivery) =>
          delivery.providerMessageId ? (
            <span className="break-value">{delivery.providerMessageId}</span>
          ) : (
            <span className="body-copy">{delivery.providerError ?? '—'}</span>
          ),
      },
      {
        key: 'created',
        header: 'Creado',
        render: (delivery) => formatDate(delivery.createdAt),
      },
      {
        key: 'sent',
        header: 'Enviado',
        render: (delivery) =>
          delivery.sentAt ? formatDate(delivery.sentAt) : '—',
      },
    ],
    []
  );

  const canGoBack = offset > 0;
  const canGoForward = offset + PAGE_SIZE < total;

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Envíos de correo</p>
          <h1 className="page-title">Panel de envío de notificaciones</h1>
          <p className="body-copy">
            Cada intento de envío de este colegio, con su estado y su número de reintentos.
            El envío es automático; este panel es de solo lectura.
          </p>
        </div>
      </header>

      {state && !state.emailNotificationsEnabled ? (
        <div className="alert alert-info">
          Las notificaciones por correo están deshabilitadas para este colegio. El panel
          sigue visible, pero no se encola ni se envía ningún correo.
        </div>
      ) : null}
      {state && !state.senderIdentityConfigured ? (
        <div className="alert alert-info">
          No hay una identidad de remitente configurada. Defina un nombre de remitente
          en la página de edición de la institución o no se enviará nada.
        </div>
      ) : null}

      <section className="card filter-panel">
        <form className="grid grid-2" onSubmit={(event) => event.preventDefault()}>
          <div className="form-field">
            <label htmlFor="status">Estado</label>
            <select
              id="status"
              name="status"
              onChange={(event) => {
                setOffset(0);
                setStatus(event.target.value as EmailDeliveryStatus | '');
              }}
              value={status}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? STATUS_LABELS[option] : 'Todos los estados'}
                </option>
              ))}
            </select>
          </div>
        </form>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <div className="empty-state body-copy">Cargando envíos…</div>
      ) : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="Todavía no se registraron envíos de correo para este colegio."
          getRowKey={(delivery) => delivery.id}
          rows={deliveries}
        />
      ) : null}

      <div className="page-header pager-row">
        <p className="field-help">
          Mostrando {deliveries.length} de {total} envíos
        </p>
        <div className="button-row">
          <Button
            disabled={!canGoBack}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            variant="secondary"
          >
            Anterior
          </Button>
          <Button
            disabled={!canGoForward}
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
