import { ReportsService } from '@edunic/source/domain/reports';

// REP-03: an export is recorded only once the report has been produced, and
// the history list is scoped by the same read rule as the reports themselves.
const summaryRows = {
  student: {
    id: 'student-1',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: null,
  },
};

function createRepository() {
  return {
    findStudent: jest.fn().mockResolvedValue(summaryRows.student),
    listStudentGrades: jest.fn().mockResolvedValue([]),
    listStudentEnrollments: jest.fn().mockResolvedValue([]),
    recordExport: jest.fn().mockResolvedValue(undefined),
    listHistory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
}

function createAccess(overrides: Record<string, jest.Mock> = {}) {
  return {
    assertCanReadStudent: jest.fn().mockResolvedValue(undefined),
    resolveReadableStudents: jest.fn().mockResolvedValue({ all: true }),
    ...overrides,
  };
}

const director = { role: 'director', userId: 'director-1' };

describe('ReportsService export history', () => {
  it('renders the PDF, then records the export', async () => {
    const repository = createRepository();
    const renderer = {
      renderStudentAcademicSummaryPdf: jest
        .fn()
        .mockResolvedValue(Buffer.from('%PDF')),
    };
    const service = new ReportsService(
      repository as never,
      createAccess() as never,
      renderer as never
    );

    const result = await service.exportStudentAcademicSummaryPdf({
      studentId: 'student-1',
      year: 2026,
      actor: director,
    });

    expect(result.pdf.toString()).toBe('%PDF');
    expect(result.filename).toBe('student-academic-summary-student-1-2026.pdf');
    expect(repository.recordExport).toHaveBeenCalledWith({
      studentId: 'student-1',
      year: 2026,
      reportType: 'academic_summary_pdf',
      createdByUserId: 'director-1',
    });
    expect(
      renderer.renderStudentAcademicSummaryPdf.mock.invocationCallOrder[0]
    ).toBeLessThan(repository.recordExport.mock.invocationCallOrder[0]);
  });

  it('records nothing when the PDF cannot be rendered', async () => {
    const repository = createRepository();
    const renderer = {
      renderStudentAcademicSummaryPdf: jest
        .fn()
        .mockRejectedValue(new Error('pdfkit failed')),
    };
    const service = new ReportsService(
      repository as never,
      createAccess() as never,
      renderer as never
    );

    await expect(
      service.exportStudentAcademicSummaryPdf({
        studentId: 'student-1',
        year: 2026,
        actor: director,
      })
    ).rejects.toThrow('pdfkit failed');
    expect(repository.recordExport).not.toHaveBeenCalled();
  });

  it('lists the whole history to the administration', async () => {
    const repository = createRepository();
    const service = new ReportsService(
      repository as never,
      createAccess() as never
    );

    await service.listReportHistory({ actor: director, limit: 25, offset: 0 });

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ studentIds: undefined, limit: 25, offset: 0 })
    );
  });

  it("scopes a teacher's history to their students", async () => {
    const repository = createRepository();
    const access = createAccess({
      resolveReadableStudents: jest
        .fn()
        .mockResolvedValue({ all: false, studentIds: ['student-1'] }),
    });
    const service = new ReportsService(repository as never, access as never);

    await service.listReportHistory({
      actor: { role: 'teacher', userId: 'teacher-1' },
      limit: 25,
      offset: 0,
    });

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ studentIds: ['student-1'] })
    );
  });

  it('refuses the history to a parent before reading anything', async () => {
    const repository = createRepository();
    const access = createAccess();
    const service = new ReportsService(repository as never, access as never);

    await expect(
      service.listReportHistory({
        actor: { role: 'parent', userId: 'parent-1' },
        limit: 25,
        offset: 0,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(access.resolveReadableStudents).not.toHaveBeenCalled();
    expect(repository.listHistory).not.toHaveBeenCalled();
  });
});
