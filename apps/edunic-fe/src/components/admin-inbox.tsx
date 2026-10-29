'use client';

import { Bell, Mail, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  apiRequest,
  buildQuery,
  type ApiListResponse,
  type DashboardNotification,
  type WorkflowMessage,
} from '@/lib/api';
import { ActivityMark } from './activity-mark';
import { Button } from './button';
import { PanelState } from './panel-state';

const PREVIEW_LIMIT = 6;

type InboxKey = 'notifications' | 'messages';

type InboxItem = {
  id: string;
  title: string;
  body: string;
  unread: boolean;
};

export function AdminInbox({ userId }: { userId: string }) {
  const [open, setOpen] = useState<InboxKey | null>(null);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [messages, setMessages] = useState<WorkflowMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadInbox();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function loadInbox() {
    setError('');

    try {
      const [notificationResult, unreadResult, messageResult] = await Promise.all([
        apiRequest<ApiListResponse<DashboardNotification>>(
          `/notifications${buildQuery({ limit: PREVIEW_LIMIT })}`
        ),
        apiRequest<ApiListResponse<DashboardNotification>>(
          `/notifications${buildQuery({ unreadOnly: 'true', limit: 1 })}`
        ),
        apiRequest<ApiListResponse<WorkflowMessage>>(`/messages${buildQuery({ limit: 50 })}`),
      ]);

      setNotifications(notificationResult.data);
      setUnreadNotifications(unreadResult.meta.total);
      setMessages(messageResult.data.filter((message) => message.recipientUserId === userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la bandeja');
    } finally {
      setLoading(false);
    }
  }

  async function markRead(path: string, id: string) {
    setSavingId(id);
    setError('');

    try {
      await apiRequest(path, { method: 'PATCH' });
      await loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar como leído');
    } finally {
      setSavingId('');
    }
  }

  const unreadMessages = messages.filter((message) => !message.readAt).length;

  function toggle(key: InboxKey) {
    setOpen((current) => (current === key ? null : key));
  }

  return (
    <div className="admin-inbox" ref={rootRef}>
      <InboxMenu
        count={unreadNotifications}
        empty="No hay notificaciones."
        error={error}
        footer={<Link className="panel-link" href="/admin/notifications">Ver todo</Link>}
        icon={Bell}
        items={notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.message,
          unread: !notification.readAt,
        }))}
        kind="notification"
        label="Notificaciones"
        loading={loading}
        markLabel="Marcar como leída"
        onMarkRead={(id) => void markRead(`/notifications/${id}/read`, id)}
        onToggle={() => toggle('notifications')}
        open={open === 'notifications'}
        readLabel="Leída"
        savingId={savingId}
      />
      <InboxMenu
        count={unreadMessages}
        empty="No hay mensajes."
        error={error}
        footer={<Link className="panel-link" href="/admin/workflows">Ver todo</Link>}
        icon={Mail}
        items={messages.slice(0, PREVIEW_LIMIT).map((message) => ({
          id: message.id,
          title: message.subject,
          body: message.body,
          unread: !message.readAt,
        }))}
        kind="message"
        label="Mensajes"
        loading={loading}
        markLabel="Marcar como leído"
        onMarkRead={(id) => void markRead(`/messages/${id}/read`, id)}
        onToggle={() => toggle('messages')}
        open={open === 'messages'}
        readLabel="Leído"
        savingId={savingId}
      />
    </div>
  );
}

type InboxMenuProps = {
  label: string;
  icon: LucideIcon;
  kind: 'notification' | 'message';
  count: number;
  items: InboxItem[];
  open: boolean;
  loading: boolean;
  error: string;
  empty: string;
  markLabel: string;
  readLabel: string;
  savingId: string;
  footer: ReactNode;
  onToggle: () => void;
  onMarkRead: (id: string) => void;
};

function InboxMenu({
  label,
  icon: Icon,
  kind,
  count,
  items,
  open,
  loading,
  error,
  empty,
  markLabel,
  readLabel,
  savingId,
  footer,
  onToggle,
  onMarkRead,
}: InboxMenuProps) {
  const panelId = `admin-inbox-${kind}`;
  const accessibleLabel = count > 0 ? `${label} (${count} sin leer)` : label;

  return (
    <div className="admin-inbox-menu">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={accessibleLabel}
        className="admin-inbox-trigger"
        onClick={onToggle}
        title={label}
        type="button"
      >
        <Icon aria-hidden="true" size={18} strokeWidth={2} />
        {count > 0 ? (
          <span aria-hidden="true" className="admin-inbox-count">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <section aria-label={label} className="admin-inbox-panel" id={panelId}>
          <div className="panel-header">
            <h2 className="section-title">{label}</h2>
            {footer}
          </div>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <div className="activity-list">
            {items.map((item) => (
              <article
                className="activity-row activity-row-action"
                data-unread={item.unread}
                key={item.id}
              >
                <ActivityMark kind={kind} />
                <span>
                  <strong>{item.title}</strong>
                  <p className="field-help">{item.body}</p>
                </span>
                {item.unread ? (
                  <Button
                    className="button-small"
                    disabled={savingId === item.id}
                    onClick={() => onMarkRead(item.id)}
                    variant="secondary"
                  >
                    {markLabel}
                  </Button>
                ) : (
                  <span className="activity-row-meta">{readLabel}</span>
                )}
              </article>
            ))}
            {loading ? <PanelState message="Cargando…" tone="loading" /> : null}
            {!loading && items.length === 0 ? <PanelState message={empty} /> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
