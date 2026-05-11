'use client';

import { Button } from './button';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-modal="true"
        className="dialog"
        role="dialog"
        aria-labelledby="confirm-dialog-title"
      >
        <p className="eyebrow">Confirm action</p>
        <h2 className="section-title" id="confirm-dialog-title">
          {title}
        </h2>
        <p className="body-copy">{body}</p>
        <div className="button-row">
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button disabled={busy} onClick={onConfirm} variant="danger">
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
