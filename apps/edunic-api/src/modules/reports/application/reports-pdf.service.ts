import PDFDocument from 'pdfkit';

type SubjectAverage = {
  subject: string;
  average: number | null;
};

type TermAverage = {
  academicPeriodId: string;
  term: number;
  average: number | null;
  promotionStatus: string | null;
  subjects: SubjectAverage[];
};

type EnrollmentSummary = {
  enrollmentId: string;
  academicPeriodId: string;
  term: number;
  status: string | null;
  promotionStatus: string | null;
};

type StudentAcademicSummary = {
  institutionId: string;
  year: number;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    dateOfBirth: string | null;
  };
  annualAverage: number | null;
  annualSubjects: SubjectAverage[];
  termAverages: TermAverage[];
  enrollments: EnrollmentSummary[];
};

export class ReportsPdfService {
  async renderStudentAcademicSummaryPdf(summary: StudentAcademicSummary) {
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

    this.renderHeader(document, summary);
    this.renderAnnualSection(document, summary);
    this.renderTermSection(document, summary.termAverages);
    this.renderEnrollmentSection(document, summary.enrollments);

    document.end();

    return completion;
  }

  private renderHeader(document: PDFKit.PDFDocument, summary: StudentAcademicSummary) {
    document
      .fontSize(22)
      .text('Academic Summary Report', { align: 'left' });

    document
      .moveDown(0.5)
      .fontSize(11)
      .text(`Student: ${summary.student.fullName}`)
      .text(`Student ID: ${summary.student.id}`)
      .text(`Institution ID: ${summary.institutionId}`)
      .text(`Academic Year: ${summary.year}`);

    if (summary.student.dateOfBirth) {
      document.text(`Date of Birth: ${summary.student.dateOfBirth}`);
    }

    document.moveDown();
  }

  private renderAnnualSection(document: PDFKit.PDFDocument, summary: StudentAcademicSummary) {
    document.fontSize(16).text('Annual Performance');
    document.moveDown(0.4);
    document
      .fontSize(11)
      .text(
        `Annual Average: ${summary.annualAverage === null ? 'N/A' : summary.annualAverage.toFixed(2)}`
      );

    document.moveDown(0.4);
    document.fontSize(12).text('Subjects');
    document.moveDown(0.3);

    if (summary.annualSubjects.length === 0) {
      document.fontSize(10).text('No grades available for this year.');
      document.moveDown();
      return;
    }

    for (const subject of summary.annualSubjects) {
      document
        .fontSize(10)
        .text(
          `${subject.subject}: ${
            subject.average === null ? 'N/A' : subject.average.toFixed(2)
          }`
        );
    }

    document.moveDown();
  }

  private renderTermSection(
    document: PDFKit.PDFDocument,
    termAverages: TermAverage[]
  ) {
    document.fontSize(16).text('Term Breakdown');
    document.moveDown(0.4);

    if (termAverages.length === 0) {
      document.fontSize(10).text('No academic periods found for this year.');
      document.moveDown();
      return;
    }

    for (const term of termAverages) {
      document
        .fontSize(12)
        .text(
          `Term ${term.term} - Average: ${
            term.average === null ? 'N/A' : term.average.toFixed(2)
          }`
        )
        .fontSize(10)
        .text(`Promotion Status: ${term.promotionStatus ?? 'N/A'}`);

      if (term.subjects.length === 0) {
        document.text('Subjects: No grades available');
      } else {
        for (const subject of term.subjects) {
          document.text(
            `- ${subject.subject}: ${
              subject.average === null ? 'N/A' : subject.average.toFixed(2)
            }`
          );
        }
      }

      document.moveDown(0.6);
    }
  }

  private renderEnrollmentSection(
    document: PDFKit.PDFDocument,
    enrollments: EnrollmentSummary[]
  ) {
    document.fontSize(16).text('Enrollments');
    document.moveDown(0.4);

    if (enrollments.length === 0) {
      document.fontSize(10).text('No enrollments found for this year.');
      return;
    }

    for (const enrollment of enrollments) {
      document
        .fontSize(10)
        .text(
          `Term ${enrollment.term} | Enrollment: ${enrollment.enrollmentId} | Status: ${enrollment.status ?? 'N/A'} | Promotion: ${enrollment.promotionStatus ?? 'N/A'}`
        );
    }
  }
}
