'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DataTable } from '@/components/data-table';
import { FormField } from '@/components/form-field';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  downloadFile,
  formatCents,
  formatDate,
  type ApiListResponse,
  type ApiSingleResponse,
  type DashboardPaymentBalance,
  type Payment,
  type PaymentStatus,
  type Student,
} from '@/lib/api';

const METHODS = ['cash', 'transfer', 'card', 'check'];

const STATUS_BADGE: Record<PaymentStatus, string> = {
  pending: 'badge',
  paid: 'badge badge-green',
  cancelled: 'badge badge-red',
};

// PAY-01 / PAY-03: the director records offline payments, follows what every
// student owes, marks payments paid or cancelled, and hands out receipts.
export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balances, setBalances] = useState<DashboardPaymentBalance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [studentId, setStudentId] = useState('');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [method, setMethod] = useState(METHODS[0]);
  const [paidNow, setPaidNow] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadAll(statusFilter);
  }, [statusFilter]);

  async function loadAll(status: PaymentStatus | '') {
    setLoading(true);
    setError('');

    try {
      const [paymentResult, balanceResult, studentResult] = await Promise.all([
        apiRequest<ApiListResponse<Payment>>(
          `/payments?limit=100${status ? `&status=${status}` : ''}`
        ),
        apiRequest<ApiListResponse<DashboardPaymentBalance>>('/payments/balances'),
        apiRequest<ApiListResponse<Student>>('/students?limit=100&sortBy=lastName&sortOrder=asc'),
      ]);
      setPayments(paymentResult.data);
      setBalances(balanceResult.data);
      setStudents(studentResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payments');
    } finally {
      setLoading(false);
    }
  }

  const studentNames = useMemo(
    () => new Map(students.map((student) => [student.id, student.fullName])),
    [students]
  );
  const amountCents = Math.round(Number(amount) * 100);
  const canRecord =
    !saving &&
    studentId !== '' &&
    concept.trim().length > 0 &&
    Number.isFinite(amountCents) &&
    amountCents > 0;
  const outstanding = balances.reduce((sum, balance) => sum + balance.outstandingCents, 0);
  const overdue = balances.reduce((sum, balance) => sum + balance.overdueCount, 0);

  async function run(action: () => Promise<void>, success: string, failure: string) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await action();
      setNotice(success);
      await loadAll(statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setSaving(false);
    }
  }

  function recordPayment() {
    void run(
      async () => {
        await apiRequest<ApiSingleResponse<Payment>>('/payments', {
          method: 'POST',
          body: {
            studentId,
            concept,
            amountCents,
            dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`).toISOString() : undefined,
            method,
            status: paidNow ? 'paid' : 'pending',
            note: note.trim() || undefined,
          },
        });
        setConcept('');
        setAmount('');
        setDueDate('');
        setPaidNow(false);
        setNote('');
      },
      'Payment recorded.',
      'Unable to record the payment'
    );
  }

  function setStatus(payment: Payment, status: PaymentStatus) {
    void run(
      async () => {
        await apiRequest(`/payments/${payment.id}`, {
          method: 'PATCH',
          body: { status },
        });
      },
      status === 'paid' ? 'Payment marked as paid.' : 'Payment cancelled.',
      'Unable to update the payment'
    );
  }

  async function downloadReceipt(payment: Payment) {
    setError('');

    try {
      await downloadFile(
        `/payments/${payment.id}/receipt`,
        `receipt-${payment.receiptNumber}.pdf`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download the receipt');
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Payments</p>
          <h1 className="page-title">Payment ledger</h1>
          <p className="body-copy">
            Record offline payments, follow balances and hand out receipts.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Record</p>
              <h2 className="section-title">New payment</h2>
            </div>
          </div>
          <div className="form">
            <div className="form-field">
              <label htmlFor="paymentStudent">Student</label>
              <select id="paymentStudent" onChange={(event) => setStudentId(event.target.value)} value={studentId}>
                <option value="">Choose a student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
            </div>
            <FormField label="Concept" name="paymentConcept" onChange={(event) => setConcept(event.target.value)} value={concept} />
            <FormField
              inputMode="decimal"
              label="Amount (Q)"
              min="0.01"
              name="paymentAmount"
              onChange={(event) => setAmount(event.target.value)}
              step="0.01"
              type="number"
              value={amount}
            />
            <FormField label="Due date" name="paymentDueDate" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
            <div className="form-field">
              <label htmlFor="paymentMethod">Method</label>
              <select id="paymentMethod" onChange={(event) => setMethod(event.target.value)} value={method}>
                {METHODS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox-row">
              <input checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} type="checkbox" />
              Paid now
            </label>
            <FormField label="Note" name="paymentNote" onChange={(event) => setNote(event.target.value)} value={note} />
            <Button disabled={!canRecord} onClick={recordPayment}>
              {saving ? 'Saving...' : 'Record payment'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Balances</p>
              <h2 className="section-title">{formatCents(outstanding)} outstanding</h2>
            </div>
          </div>
          <p className="body-copy">
            {overdue} overdue {overdue === 1 ? 'payment' : 'payments'} across {balances.length}{' '}
            {balances.length === 1 ? 'student' : 'students'}.
          </p>
          <DataTable
            columns={[
              { key: 'student', header: 'Student', render: (balance) => balance.studentName },
              { key: 'billed', header: 'Billed', align: 'right', render: (balance) => formatCents(balance.billedCents) },
              { key: 'paid', header: 'Paid', align: 'right', render: (balance) => formatCents(balance.paidCents) },
              {
                key: 'outstanding',
                header: 'Owes',
                align: 'right',
                render: (balance) => (
                  <span className={balance.overdueCount > 0 ? 'badge badge-red' : undefined}>
                    {formatCents(balance.outstandingCents)}
                  </span>
                ),
              },
            ]}
            emptyMessage="No balances yet."
            getRowKey={(balance) => balance.studentId}
            rows={balances}
          />
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2 className="section-title">
              {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
            </h2>
          </div>
          <div className="form-field">
            <label htmlFor="paymentStatusFilter">Status</label>
            <select
              id="paymentStatusFilter"
              onChange={(event) => setStatusFilter(event.target.value as PaymentStatus | '')}
              value={statusFilter}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        {loading ? (
          <PanelState message="Loading payments..." tone="loading" />
        ) : (
          <DataTable
            columns={[
              { key: 'receipt', header: 'Receipt', render: (payment) => payment.receiptNumber },
              {
                key: 'student',
                header: 'Student',
                render: (payment) => studentNames.get(payment.studentId) ?? payment.studentId,
              },
              { key: 'concept', header: 'Concept', render: (payment) => payment.concept },
              { key: 'amount', header: 'Amount', align: 'right', render: (payment) => formatCents(payment.amountCents) },
              {
                key: 'due',
                header: 'Due',
                render: (payment) => (payment.dueDate ? formatDate(payment.dueDate) : '-'),
              },
              {
                key: 'status',
                header: 'Status',
                render: (payment) => (
                  <span className={STATUS_BADGE[payment.status]}>{payment.status}</span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (payment) => (
                  <span className="table-actions">
                    {payment.status === 'pending' ? (
                      <>
                        <Button disabled={saving} onClick={() => setStatus(payment, 'paid')} variant="secondary">
                          Mark paid
                        </Button>
                        <Button disabled={saving} onClick={() => setStatus(payment, 'cancelled')} variant="ghost">
                          Cancel
                        </Button>
                      </>
                    ) : null}
                    <Button onClick={() => void downloadReceipt(payment)} variant="ghost">
                      Receipt
                    </Button>
                  </span>
                ),
              },
            ]}
            emptyMessage="No payments recorded."
            getRowKey={(payment) => payment.id}
            rows={payments}
          />
        )}
      </section>
    </AdminShell>
  );
}
