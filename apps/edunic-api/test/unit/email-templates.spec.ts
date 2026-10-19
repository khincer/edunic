import {
  buildAttendanceEmail,
  buildGradeEmail,
  buildWelcomeEmail,
} from '@edunic/source/domain/notifications';

// Fixed copy for this slice (design D8/Q9): the builders interpolate the
// institution sender name and the student display name only.
describe('email templates', () => {
  it('builds the welcome message from the institution sender name', () => {
    expect(
      buildWelcomeEmail({
        senderName: 'Colegio Las Flores',
        studentName: 'Jane Doe',
      })
    ).toEqual({
      subject: 'Welcome to Colegio Las Flores',
      text: [
        'Hello,',
        '',
        'Colegio Las Flores has enrolled Jane Doe.',
        '',
        'You will receive grades, attendance notices and school updates at this address.',
        '',
        'Colegio Las Flores',
      ].join('\n'),
    });
  });

  it('builds the grade message with the course, score and sender name', () => {
    expect(
      buildGradeEmail({
        senderName: 'Colegio Las Flores',
        studentName: 'Jane Doe',
        courseName: 'Mathematics',
        score: 92,
      })
    ).toEqual({
      subject: 'Grade published for Jane Doe',
      text: [
        'Hello,',
        '',
        'Colegio Las Flores published a new grade for Jane Doe.',
        '',
        'Course: Mathematics',
        'Score: 92',
        '',
        'Colegio Las Flores',
      ].join('\n'),
    });
  });

  it('builds the absence message with the date and sender name', () => {
    expect(
      buildAttendanceEmail({
        senderName: 'Colegio Las Flores',
        studentName: 'Jane Doe',
        date: '2026-02-03',
        status: 'absent',
      })
    ).toEqual({
      subject: 'Absence recorded for Jane Doe',
      text: [
        'Hello,',
        '',
        'Colegio Las Flores recorded an absence for Jane Doe on 2026-02-03.',
        '',
        'Please contact the school if this record is not correct.',
        '',
        'Colegio Las Flores',
      ].join('\n'),
    });
  });

  it('builds a late-arrival message when the status is late', () => {
    expect(
      buildAttendanceEmail({
        senderName: 'Colegio Las Flores',
        studentName: 'Jane Doe',
        date: '2026-02-03',
        status: 'late',
      })
    ).toEqual({
      subject: 'Late arrival recorded for Jane Doe',
      text: [
        'Hello,',
        '',
        'Colegio Las Flores recorded a late arrival for Jane Doe on 2026-02-03.',
        '',
        'Please contact the school if this record is not correct.',
        '',
        'Colegio Las Flores',
      ].join('\n'),
    });
  });

  it('builds a present message when the status is present', () => {
    expect(
      buildAttendanceEmail({
        senderName: 'Colegio Las Flores',
        studentName: 'Jane Doe',
        date: '2026-02-03',
        status: 'present',
      })
    ).toEqual({
      subject: 'Attendance recorded for Jane Doe',
      text: [
        'Hello,',
        '',
        'Colegio Las Flores recorded Jane Doe as present on 2026-02-03.',
        '',
        'Colegio Las Flores',
      ].join('\n'),
    });
  });

  it('renders an attendance date given as a Date as the same calendar day', () => {
    expect(
      buildAttendanceEmail({
        senderName: 'Colegio Las Flores',
        studentName: 'Jane Doe',
        date: new Date('2026-02-03T00:00:00.000Z'),
        status: 'absent',
      }).text
    ).toContain('on 2026-02-03.');
  });
});
