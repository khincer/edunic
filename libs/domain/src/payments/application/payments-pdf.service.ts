import PDFDocument from 'pdfkit';

export type PaymentReceipt = {
  receiptNumber: string;
  concept: string;
  amountCents: number;
  dueDate: Date | string | null;
  paidAt: Date | string | null;
  method: string;
  status: string;
  note: string | null;
  issuedAt: Date | string | null;
  student: {
    id: string;
    fullName: string;
  };
  school: {
    name: string;
    senderName: string | null;
    replyToEmail: string | null;
  };
};

function formatAmount(amountCents: number) {
  return `Q${(amountCents / 100).toFixed(2)}`;
}

// The driver hands the date over as a Date or as a string depending on
// the column, so the receipt reads both.
function formatDate(value: Date | string | null) {
  if (!value) {
    return '-';
  }

  return typeof value === 'string'
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

export class PaymentsPdfService {
  async renderPaymentReceiptPdf(receipt: PaymentReceipt) {
    const document = new PDFDocument({
      margin: 48,
      size: 'A4',
    });

    const chunks: Buffer[] = [];

    document.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const completion = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      document.on('error', reject);
    });

    this.renderHeader(document, receipt);
    this.renderDetails(document, receipt);
    this.renderFooter(document, receipt);

    document.end();

    return completion;
  }

  private renderHeader(document: PDFKit.PDFDocument, receipt: PaymentReceipt) {
    document.fontSize(22).text('Payment Receipt', { align: 'left' });

    document
      .moveDown(0.5)
      .fontSize(11)
      .text(`School: ${receipt.school.name}`)
      .text(`Receipt: ${receipt.receiptNumber}`);

    if (receipt.school.senderName) {
      document.text(`From: ${receipt.school.senderName}`);
    }

    if (receipt.school.replyToEmail) {
      document.text(`Contact: ${receipt.school.replyToEmail}`);
    }

    document.moveDown();
  }

  private renderDetails(document: PDFKit.PDFDocument, receipt: PaymentReceipt) {
    document.fontSize(16).text('Payment');
    document.moveDown(0.4);

    document
      .fontSize(11)
      .text(`Student: ${receipt.student.fullName}`)
      .text(`Student ID: ${receipt.student.id}`)
      .text(`Concept: ${receipt.concept}`)
      .text(`Amount: ${formatAmount(receipt.amountCents)}`)
      .text(`Method: ${receipt.method}`)
      .text(`Status: ${receipt.status}`)
      .text(`Due date: ${formatDate(receipt.dueDate)}`)
      .text(`Paid on: ${formatDate(receipt.paidAt)}`)
      .text(`Issued on: ${formatDate(receipt.issuedAt)}`);

    if (receipt.note) {
      document.text(`Note: ${receipt.note}`);
    }

    document.moveDown();
  }

  private renderFooter(
    document: PDFKit.PDFDocument,
    receipt: PaymentReceipt
  ) {
    document
      .fontSize(9)
      .fillColor('#666666')
      .text(
        'This receipt proves that the payment above was registered at the school desk.',
        { align: 'left' }
      )
      .fillColor('#000000');
  }
}
