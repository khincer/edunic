'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { getSession } from '@/lib/auth';
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
      const institutionId = getSession()?.user.institutionId;

      if (!institutionId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [stateResult, deliveriesResult] = await Promise.all([
          apiRequest<ApiSingleResponse<EmailDeliveryState>>(
            '/notifications/deliveries/state',
            { institutionId }
          ),
          apiRequest<ApiListResponse<EmailDelivery>>(
            `/notifications/deliveries${buildQuery({
              status,
              limit: PAGE_SIZE,
              offset,
            })}`,
            { institutionId }
          ),
        ]);

        setState(stateResult.data);
        setDeliveries(deliveriesResult.data);
        setTotal(deliveriesResult.meta.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load email deliveries'
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
        header: 'Recipient',
        render: (delivery) => (
          <>
            <strong>{delivery.recipientAddress}</strong>
            <p className="field-help">{delivery.recipientSource}</p>
          </>
        ),
      },
      { key: 'event', header: 'Event', render: (delivery) => delivery.eventName },
      {
        key: 'status',
        header: 'Status',
        render: (delivery) => (
          <span className={STATUS_BADGE[delivery.status]}>{delivery.status}</span>
        ),
      },
      {
        key: 'attempts',
        header: 'Attempts',
        align: 'right',
        render: (delivery) => delivery.attemptCount,
      },
      {
        key: 'provider',
        header: 'Provider',
        render: (delivery) =>
          delivery.providerMessageId ? (
            <span className="break-value">{delivery.providerMessageId}</span>
          ) : (
            <span className="body-copy">{delivery.providerError ?? '—'}</span>
          ),
      },
      {
        key: 'created',
        header: 'Created',
        render: (delivery) => formatDate(delivery.createdAt),
      },
      {
        key: 'sent',
        header: 'Sent',
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
          <p className="eyebrow">Email deliveries</p>
          <h1 className="page-title">Notification delivery panel</h1>
          <p className="body-copy">
            Every send attempt for this school, with its status and retry count.
            Delivery is automatic; this panel is read-only.
          </p>
        </div>
      </header>

      {state && !state.emailNotificationsEnabled ? (
        <div className="alert alert-info">
          Email notifications are disabled for this school. The panel stays
          visible, but no email is enqueued or sent.
        </div>
      ) : null}
      {state && !state.senderIdentityConfigured ? (
        <div className="alert alert-info">
          No sender identity is configured. Set a sender name on the institution
          edit page or nothing is sent.
        </div>
      ) : null}

      <section className="card filter-panel">
        <form className="grid grid-2" onSubmit={(event) => event.preventDefault()}>
          <div className="form-field">
            <label htmlFor="status">Status</label>
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
                  {option || 'All statuses'}
                </option>
              ))}
            </select>
          </div>
        </form>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <div className="empty-state body-copy">Loading deliveries...</div>
      ) : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="No email deliveries have been recorded for this school yet."
          getRowKey={(delivery) => delivery.id}
          rows={deliveries}
        />
      ) : null}

      <div className="page-header pager-row">
        <p className="field-help">
          Showing {deliveries.length} of {total} deliveries
        </p>
        <div className="button-row">
          <Button
            disabled={!canGoBack}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            variant="secondary"
          >
            Previous
          </Button>
          <Button
            disabled={!canGoForward}
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
