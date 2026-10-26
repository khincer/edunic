export type CsvValue = string | number | null | undefined;

// A text cell starting with one of these is read as a formula by spreadsheet
// software (CSV injection), so it is prefixed with a single quote.
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

// One RFC 4180 cell: quoted when it holds a comma, a quote or a line break,
// with inner quotes doubled.
export function toCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  const text = FORMULA_LEAD.test(value) ? `'${value}` : value;

  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// A whole document: header first, CRLF after every row.
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows]
    .map((row) => row.map((cell) => toCsvCell(cell)).join(',') + '\r\n')
    .join('');
}
