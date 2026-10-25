import type { FastifyInstance } from 'fastify';
import { AccessRepository, AccessService, ADMIN_ROLES, adminAnd } from '@edunic/source/domain/authorization';
import {
  PaymentsPdfService,
  PaymentsRepository,
  PaymentsService,
  createPaymentBodySchema,
  listPaymentsQuerySchema,
  paymentParamsSchema,
  updatePaymentBodySchema,
} from '@edunic/source/domain/payments';
import { parseWithSchema } from '@edunic/source/domain/shared';

export async function paymentRoutes(app: FastifyInstance) {
  const paymentsService = new PaymentsService(
    new PaymentsRepository(app.db),
    new AccessService(new AccessRepository(app.db))
  );
  const paymentsPdfService = new PaymentsPdfService();
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };
  // The ledger is the school's business: an admin reads it all, a parent
  // reads the payments of their own children, a teacher reads none of it.
  const adminOrParent = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('parent'))],
  };

  // The ledger: an admin sees every payment, a parent the ones of their own
  // children.
  app.get('/', adminOrParent, async (request) => {
    const query = parseWithSchema(listPaymentsQuerySchema, request.query);

    return paymentsService.listPayments(query, {
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
    });
  });

  // What every student owes and what is late.
  app.get('/balances', adminOnly, async () => {
    return paymentsService.listStudentBalances();
  });

  app.post('/', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createPaymentBodySchema, request.body);
    const result = await paymentsService.createPayment(
      body,
      request.user?.id ?? ''
    );

    return reply.status(201).send(result);
  });

  app.get('/:paymentId', adminOrParent, async (request) => {
    const params = parseWithSchema(paymentParamsSchema, request.params);

    return paymentsService.getPayment(params.paymentId, {
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
    });
  });

  // The receipt of a payment: an admin or the parent of that student.
  app.get('/:paymentId/receipt', adminOrParent, async (request, reply) => {
    const params = parseWithSchema(paymentParamsSchema, request.params);

    const result = await paymentsService.getPaymentReceipt(params.paymentId, {
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
    });

    const pdf = await paymentsPdfService.renderPaymentReceiptPdf(result.data);

    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="payment-receipt-${params.paymentId}.pdf"`
      )
      .send(pdf);
  });

  app.patch('/:paymentId', adminOnly, async (request) => {
    const params = parseWithSchema(paymentParamsSchema, request.params);
    const body = parseWithSchema(updatePaymentBodySchema, request.body);

    return paymentsService.updatePayment(params.paymentId, body);
  });
}
