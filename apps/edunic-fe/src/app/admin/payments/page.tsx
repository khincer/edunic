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

const paymentMethodLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  cancelled: 'Cancelado',
};

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
        apiRequest<ApiListResponse<Student>>('/students?limit=100&sortBy=firstLastName&sortOrder=asc'),
      ]);
      setPayments(paymentResult.data);
      setBalances(balanceResult.data);
      setStudents(studentResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos');
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
      'Pago registrado.',
      'No se pudo registrar el pago'
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
      status === 'paid' ? 'Pago marcado como pagado.' : 'Pago cancelado.',
      'No se pudo actualizar el pago'
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
      setError(err instanceof Error ? err.message : 'No se pudo descargar el recibo');
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Pagos</p>
          <h1 className="page-title">Libro de pagos</h1>
          <p className="body-copy">
            Registre pagos presenciales, siga los saldos y entregue recibos.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Registrar</p>
              <h2 className="section-title">Nuevo pago</h2>
            </div>
          </div>
          <div className="form">
            <div className="form-field">
              <label htmlFor="paymentStudent">Estudiante</label>
              <select id="paymentStudent" onChange={(event) => setStudentId(event.target.value)} value={studentId}>
                <option value="">Seleccione un estudiante</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
            </div>
            <FormField label="Concepto" name="paymentConcept" onChange={(event) => setConcept(event.target.value)} value={concept} />
            <FormField
              inputMode="decimal"
              label="Monto (C$)"
              min="0.01"
              name="paymentAmount"
              onChange={(event) => setAmount(event.target.value)}
              step="0.01"
              type="number"
              value={amount}
            />
            <FormField label="Fecha de vencimiento" name="paymentDueDate" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
            <div className="form-field">
              <label htmlFor="paymentMethod">Método</label>
              <select id="paymentMethod" onChange={(event) => setMethod(event.target.value)} value={method}>
                {METHODS.map((option) => (
                  <option key={option} value={option}>
                    {paymentMethodLabels[option] ?? option}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox-row">
              <input checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} type="checkbox" />
              Pagado ahora
            </label>
            <FormField label="Nota" name="paymentNote" onChange={(event) => setNote(event.target.value)} value={note} />
            <Button disabled={!canRecord} onClick={recordPayment}>
              {saving ? 'Guardando…' : 'Registrar pago'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Saldos</p>
              <h2 className="section-title">{formatCents(outstanding)} pendiente</h2>
            </div>
          </div>
          <p className="body-copy">
            {overdue} {overdue === 1 ? 'pago vencido' : 'pagos vencidos'} en {balances.length}{' '}
            {balances.length === 1 ? 'estudiante' : 'estudiantes'}.
          </p>
          <DataTable
            columns={[
              { key: 'student', header: 'Estudiante', render: (balance) => balance.studentName },
              { key: 'billed', header: 'Facturado', align: 'right', render: (balance) => formatCents(balance.billedCents) },
              { key: 'paid', header: 'Pagado', align: 'right', render: (balance) => formatCents(balance.paidCents) },
              {
                key: 'outstanding',
                header: 'Adeudado',
                align: 'right',
                render: (balance) => (
                  <span className={balance.overdueCount > 0 ? 'badge badge-red' : undefined}>
                    {formatCents(balance.outstandingCents)}
                  </span>
                ),
              },
            ]}
            emptyMessage="Todavía no hay saldos."
            getRowKey={(balance) => balance.studentId}
            rows={balances}
          />
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Libro</p>
            <h2 className="section-title">
              {payments.length} {payments.length === 1 ? 'pago' : 'pagos'}
            </h2>
          </div>
          <div className="form-field">
            <label htmlFor="paymentStatusFilter">Estado</label>
            <select
              id="paymentStatusFilter"
              onChange={(event) => setStatusFilter(event.target.value as PaymentStatus | '')}
              value={statusFilter}
            >
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="paid">Pagado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
        {loading ? (
          <PanelState message="Cargando pagos…" tone="loading" />
        ) : (
          <DataTable
            columns={[
              { key: 'receipt', header: 'Recibo', render: (payment) => payment.receiptNumber },
              {
                key: 'student',
                header: 'Estudiante',
                render: (payment) => studentNames.get(payment.studentId) ?? payment.studentId,
              },
              { key: 'concept', header: 'Concepto', render: (payment) => payment.concept },
              { key: 'amount', header: 'Monto', align: 'right', render: (payment) => formatCents(payment.amountCents) },
              {
                key: 'due',
                header: 'Vence',
                render: (payment) => (payment.dueDate ? formatDate(payment.dueDate) : '-'),
              },
              {
                key: 'status',
                header: 'Estado',
                render: (payment) => (
                  <span className={STATUS_BADGE[payment.status]}>{paymentStatusLabels[payment.status]}</span>
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
                          Marcar como pagado
                        </Button>
                        <Button disabled={saving} onClick={() => setStatus(payment, 'cancelled')} variant="ghost">
                          Cancelar
                        </Button>
                      </>
                    ) : null}
                    <Button onClick={() => void downloadReceipt(payment)} variant="ghost">
                      Recibo
                    </Button>
                  </span>
                ),
              },
            ]}
            emptyMessage="No hay pagos registrados."
            getRowKey={(payment) => payment.id}
            rows={payments}
          />
        )}
      </section>
    </AdminShell>
  );
}
