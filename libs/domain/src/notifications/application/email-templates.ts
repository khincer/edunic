// Fixed-copy email builders (design D8/Q9): this slice ships one message per
// trigger, interpolating the institution sender name and the student display
// name. Per-institution copy and translations are out of scope.

export type EmailContent = {
  subject: string;
  text: string;
};

export function buildWelcomeEmail(input: {
  senderName: string;
  studentName: string;
}): EmailContent {
  return {
    subject: `Welcome to ${input.senderName}`,
    text: joinLines([
      'Hello,',
      '',
      `${input.senderName} has enrolled ${input.studentName}.`,
      '',
      'You will receive grades, attendance notices and school updates at this address.',
      '',
      input.senderName,
    ]),
  };
}

export function buildGradeEmail(input: {
  senderName: string;
  studentName: string;
  courseName: string;
  score: number;
}): EmailContent {
  return {
    subject: `Grade published for ${input.studentName}`,
    text: joinLines([
      'Hello,',
      '',
      `${input.senderName} published a new grade for ${input.studentName}.`,
      '',
      `Course: ${input.courseName}`,
      `Score: ${input.score}`,
      '',
      input.senderName,
    ]),
  };
}

export function buildAbsenceEmail(input: {
  senderName: string;
  studentName: string;
  date: string | Date;
}): EmailContent {
  return {
    subject: `Absence recorded for ${input.studentName}`,
    text: joinLines([
      'Hello,',
      '',
      `${input.senderName} recorded an absence for ${input.studentName} on ${toCalendarDay(
        input.date
      )}.`,
      '',
      'Please contact the school if this record is not correct.',
      '',
      input.senderName,
    ]),
  };
}

function toCalendarDay(date: string | Date): string {
  return date instanceof Date ? date.toISOString().slice(0, 10) : date;
}

function joinLines(lines: string[]): string {
  return lines.join('\n');
}
