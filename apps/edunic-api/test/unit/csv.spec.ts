import { toCsv, toCsvCell } from '@edunic/source/domain/shared';

// REP-02: the CSV export follows RFC 4180 (comma separator, CRLF rows, quoted
// cells when needed) and never hands a spreadsheet a formula.
describe('toCsvCell', () => {
  it('leaves plain text and numbers as they are', () => {
    expect(toCsvCell('Jane Doe')).toBe('Jane Doe');
    expect(toCsvCell(87)).toBe('87');
    expect(toCsvCell(0)).toBe('0');
  });

  it('writes null and undefined as an empty cell', () => {
    expect(toCsvCell(null)).toBe('');
    expect(toCsvCell(undefined)).toBe('');
  });

  it('quotes cells with a comma, a quote or a line break and doubles quotes', () => {
    expect(toCsvCell('Doe, Jane')).toBe('"Doe, Jane"');
    expect(toCsvCell('The "Best"')).toBe('"The ""Best"""');
    expect(toCsvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(toCsvCell('carriage\rreturn')).toBe('"carriage\rreturn"');
  });

  it.each(['=', '+', '-', '@', '\t', '\r'])(
    'neutralises a text cell that starts with %j',
    (lead) => {
      const cell = toCsvCell(`${lead}SUM(A1:A9)`);
      expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
    }
  );

  it('neutralises formula payloads even when they also need quoting', () => {
    expect(toCsvCell('=HYPERLINK("http://x","y")')).toBe(
      `"'=HYPERLINK(""http://x"",""y"")"`
    );
  });

  it('leaves negative numbers alone: they are numbers, not text', () => {
    expect(toCsvCell(-5)).toBe('-5');
  });
});

describe('toCsv', () => {
  it('writes a header and rows separated by CRLF, ending with CRLF', () => {
    expect(
      toCsv(
        ['name', 'score'],
        [
          ['Jane', 90],
          ['Doe, John', null],
        ]
      )
    ).toBe('name,score\r\nJane,90\r\n"Doe, John",\r\n');
  });

  it('writes only the header when there are no rows', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b\r\n');
  });
});
