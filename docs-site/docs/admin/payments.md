---
title: Payments
sidebar_label: Payments
---

# Payments

## Goal

Record the payments families make at the school office, follow what every student owes,
and hand out receipts.

## Prerequisites

- An administration role (`director`, `vice_director` or `subdirector`).
- The student exists.

## In the app

1. Open `/admin/payments` (**Payments** in the console navigation).
2. Under **New payment**, choose the **Student**, enter the **Concept**, the **Amount (Q)**,
   an optional **Due date**, the **Method** and an optional **Note**. Tick **Paid now** if
   the money was received at the counter. Select **Record payment**.
3. **Balances** shows, per student, what was billed, what was paid and what is still owed,
   with the total outstanding. A red amount means a payment is overdue.
4. In **Ledger**, filter by **Status**. On a pending payment select **Mark paid** or
   **Cancel**. Select **Receipt** to download the PDF receipt.

Every payment gets a receipt number (`R-000001`, ...) when it is recorded.

## Through the API

```bash
curl -X POST "http://localhost:3000/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "studentId": "<studentId>", "concept": "Tuition March", "amountCents": 150000, "method": "cash", "dueDate": "2026-03-31T00:00:00.000Z" }'

curl -X PATCH "http://localhost:3000/payments/$PAYMENT_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "status": "paid" }'

curl "http://localhost:3000/payments/balances" -H "Authorization: Bearer $TOKEN"

curl -o receipt.pdf "http://localhost:3000/payments/$PAYMENT_ID/receipt" \
  -H "Authorization: Bearer $TOKEN"
```

Amounts are in cents. A payment marked `paid` gets its `paidAt` automatically; moving it
back to `pending` or `cancelled` clears it.

Parents read the payments and receipts of their own children (see the
[parent guide](../parent/overview.md)). Teachers have no access to payments.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Amount must be positive` / `Concept is required` | Invalid body |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Not an administration role |
| 404 | `NOT_FOUND` | `Student not found` / `Payment not found` | Unknown id |

## What is not available yet

- No online payment: the ledger records payments made in person.
- No refunds or partial payments; record a separate payment or cancel and re-record.
