import { format as tempoFormat } from '@formkit/tempo';

import { collectionsWeeklyPdf } from 'src/report/documents/collections-weekly-pdf';
import {
  formatPEN,
  sanitizeFilenameSlug,
} from 'src/report/collections-weekly-pdf.helpers';
import { WeeklyReportResponse } from 'src/report/collections-weekly-report.service';
import { capitalize } from 'src/helpers/capitalize';

function buildFullWeek(): WeeklyReportResponse {
  return {
    weekStart: '2026-07-06',
    weekEnd: '2026-07-12',
    anchorWeekday: 1,
    days: [
      { date: '2026-07-06', weekday: 0 },
      { date: '2026-07-07', weekday: 1 },
      { date: '2026-07-08', weekday: 2 },
      { date: '2026-07-09', weekday: 3 },
      { date: '2026-07-10', weekday: 4 },
      { date: '2026-07-11', weekday: 5 },
      { date: '2026-07-12', weekday: 6 },
    ],
    rows: [
      {
        accountId: 'acc-1',
        accountDate: '2026-07-06T12:00:00.000Z',
        dueDate: '2026-07-12T12:00:00.000Z',
        amount: 1000,
        remainingBalance: 500,
        creditType: 'DIARIO',
        customer: {
          id: 'c-1',
          name: 'Ada',
          lastName: 'Lovelace',
          zone: { id: 'z-1', name: 'Zone A' },
        },
        days: [
          {
            date: '2026-07-06',
            amount: 100,
            paymentIds: ['p-1'],
            paymentCount: 1,
          },
          {
            date: '2026-07-07',
            amount: null,
            paymentIds: [],
            paymentCount: 0,
          },
          {
            date: '2026-07-08',
            amount: 50,
            paymentIds: ['p-2'],
            paymentCount: 1,
          },
          {
            date: '2026-07-09',
            amount: null,
            paymentIds: [],
            paymentCount: 0,
          },
          {
            date: '2026-07-10',
            amount: null,
            paymentIds: [],
            paymentCount: 0,
          },
          {
            date: '2026-07-11',
            amount: 200,
            paymentIds: ['p-3', 'p-4'],
            paymentCount: 2,
          },
          {
            date: '2026-07-12',
            amount: null,
            paymentIds: [],
            paymentCount: 0,
          },
        ],
        weeklyTotal: 350,
      },
    ],
    totals: {
      totalCollected: 350,
      paymentCount: 4,
      byDay: [
        { date: '2026-07-06', amount: 100, paymentCount: 1 },
        { date: '2026-07-07', amount: 0, paymentCount: 0 },
        { date: '2026-07-08', amount: 50, paymentCount: 1 },
        { date: '2026-07-09', amount: 0, paymentCount: 0 },
        { date: '2026-07-10', amount: 0, paymentCount: 0 },
        { date: '2026-07-11', amount: 200, paymentCount: 2 },
        { date: '2026-07-12', amount: 0, paymentCount: 0 },
      ],
    },
  };
}

function buildEmptyWeek(): WeeklyReportResponse {
  return {
    weekStart: '2026-07-06',
    weekEnd: '2026-07-12',
    anchorWeekday: 1,
    days: [
      { date: '2026-07-06', weekday: 0 },
      { date: '2026-07-07', weekday: 1 },
      { date: '2026-07-08', weekday: 2 },
      { date: '2026-07-09', weekday: 3 },
      { date: '2026-07-10', weekday: 4 },
      { date: '2026-07-11', weekday: 5 },
      { date: '2026-07-12', weekday: 6 },
    ],
    rows: [],
    totals: {
      totalCollected: 0,
      paymentCount: 0,
      byDay: [
        { date: '2026-07-06', amount: 0, paymentCount: 0 },
        { date: '2026-07-07', amount: 0, paymentCount: 0 },
        { date: '2026-07-08', amount: 0, paymentCount: 0 },
        { date: '2026-07-09', amount: 0, paymentCount: 0 },
        { date: '2026-07-10', amount: 0, paymentCount: 0 },
        { date: '2026-07-11', amount: 0, paymentCount: 0 },
        { date: '2026-07-12', amount: 0, paymentCount: 0 },
      ],
    },
  };
}

function parseDay(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)!;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
}

function expectedWeekdayLabels(
  data: WeeklyReportResponse,
  tz: string,
): string[] {
  return data.days.map((d) =>
    capitalize(tempoFormat({ date: parseDay(d.date), format: 'ddd DD', tz })),
  );
}

function findTable(doc: ReturnType<typeof collectionsWeeklyPdf>) {
  const tableHolder = (doc.content as any[]).find((node) => node && node.table);
  return tableHolder.table as {
    headerRows: number;
    body: any[][];
    widths: any[];
  };
}

function cellText(cell: any): string {
  return typeof cell === 'string' ? cell : (cell?.text ?? '');
}

describe('collectionsWeeklyPdf — pure template', () => {
  describe('TZ-aware weekday labels', () => {
    it('renders one weekday column per entry in data.days[], formatted in the actor timezone', () => {
      const data = buildFullWeek();
      const tz = 'UTC';
      const doc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz,
      });
      const table = findTable(doc);
      const headerRow = table.body[0];

      const weekdayHeaders = headerRow.slice(7, 14);
      expect(weekdayHeaders).toHaveLength(7);
      expect(weekdayHeaders).toEqual(expectedWeekdayLabels(data, tz));
    });

    it('uses different weekday labels when the timezone changes', () => {
      const data = buildFullWeek();

      // Pacific/Apia is UTC+13, so noon UTC = 01:00 next day in Apia.
      // That guarantees the weekday labels diverge from UTC for the same week.
      const docUtc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'UTC',
      });
      const docApia = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'Pacific/Apia',
      });

      const utcLabels = findTable(docUtc).body[0].slice(7, 14);
      const apiaLabels = findTable(docApia).body[0].slice(7, 14);

      expect(utcLabels).toEqual(expectedWeekdayLabels(data, 'UTC'));
      expect(apiaLabels).toEqual(expectedWeekdayLabels(data, 'Pacific/Apia'));
      expect(utcLabels).not.toEqual(apiaLabels);
    });
  });

  describe('account row cells', () => {
    it('renders seven weekday cells per account row, PEN-formatted when amount is non-null, em-dash when null', () => {
      const data = buildFullWeek();
      const doc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'UTC',
      });
      const table = findTable(doc);
      const accountRow = table.body[1];

      expect(accountRow).toHaveLength(15);
      const dayCells = accountRow.slice(7, 14);
      expect(dayCells).toHaveLength(7);

      expect(dayCells[0]).toBe('S/ 100.00');
      expect(dayCells[1]).toBe('—');
      expect(dayCells[2]).toBe('S/ 50.00');
      expect(dayCells[3]).toBe('—');
      expect(dayCells[4]).toBe('—');
      expect(dayCells[5]).toBe('S/ 200.00');
      expect(dayCells[6]).toBe('—');
    });

    it('places the weekly total in the last column of the account row', () => {
      const data = buildFullWeek();
      const doc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'UTC',
      });
      const accountRow = findTable(doc).body[1];
      expect(accountRow[14]).toBe('S/ 350.00');
    });
  });

  describe('totals row', () => {
    it('reproduces totals.byDay[d].amount across the seven day cells and totals.totalCollected in the last column', () => {
      const data = buildFullWeek();
      const doc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'UTC',
      });
      const table = findTable(doc);
      const totalsRow = table.body[table.body.length - 1];

      expect(totalsRow).toHaveLength(15);
      const dayCellTexts = totalsRow.slice(7, 14).map(cellText);
      expect(dayCellTexts).toEqual([
        'S/ 100.00',
        'S/ 0.00',
        'S/ 50.00',
        'S/ 0.00',
        'S/ 0.00',
        'S/ 200.00',
        'S/ 0.00',
      ]);
      expect(cellText(totalsRow[14])).toBe('S/ 350.00');
    });
  });

  describe('empty week', () => {
    it('still produces a valid document shell with seven weekday headers and a zero totals row', () => {
      const data = buildEmptyWeek();
      const doc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'UTC',
      });
      const table = findTable(doc);

      expect(table.headerRows).toBe(1);
      expect(table.body[0]).toHaveLength(15);
      const weekdayHeaders = table.body[0].slice(7, 14);
      expect(weekdayHeaders).toHaveLength(7);
      expect(weekdayHeaders).toEqual(expectedWeekdayLabels(data, 'UTC'));

      // Only header + totals row when no accounts.
      expect(table.body).toHaveLength(2);

      const totalsRow = table.body[1];
      expect(totalsRow).toHaveLength(15);
      for (let i = 7; i < 14; i++) {
        expect(cellText(totalsRow[i])).toBe('S/ 0.00');
      }
      expect(cellText(totalsRow[14])).toBe('S/ 0.00');
    });
  });

  describe('page-break header repeat', () => {
    it('declares headerRows: 1 so the header row repeats on page breaks', () => {
      const data = buildFullWeek();
      const doc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'UTC',
      });
      expect(findTable(doc).headerRows).toBe(1);
    });
  });

  describe('pdfmake metadata', () => {
    it('sets a non-empty title on info so the PDF document has a title', () => {
      const data = buildFullWeek();
      const doc = collectionsWeeklyPdf({
        data,
        zoneName: 'Zone A',
        tz: 'UTC',
      });
      expect(doc.info).toBeDefined();
      const title = (doc.info as { title?: string }).title;
      expect(title).toBeTruthy();
      expect(String(title).length).toBeGreaterThan(0);
    });
  });
});

describe('sanitizeFilenameSlug', () => {
  it('lowercases, replaces [^a-z0-9-]+ with a single dash, and trims leading/trailing dashes', () => {
    expect(sanitizeFilenameSlug('Zone A!')).toBe('zone-a');
    expect(sanitizeFilenameSlug('  Zona Centro  ')).toBe('zona-centro');
    expect(sanitizeFilenameSlug('San_Borja#1')).toBe('san-borja-1');
  });

  it('collapses runs of non-allowed characters into a single dash (keeps runs of -)', () => {
    expect(sanitizeFilenameSlug('Foo   Bar!!')).toBe('foo-bar');
    expect(sanitizeFilenameSlug('Foo---Bar!!')).toBe('foo---bar');
  });

  it('produces a slug that does not contain ".." or "/" for traversal-like inputs', () => {
    const slug = sanitizeFilenameSlug('../etc/passwd');
    expect(slug).not.toContain('..');
    expect(slug).not.toContain('/');
    expect(slug).toBe('etc-passwd');
  });

  it('rejects inputs that are entirely unsafe by returning an empty slug', () => {
    expect(sanitizeFilenameSlug('!!!')).toBe('');
    expect(sanitizeFilenameSlug('///')).toBe('');
  });
});

describe('formatPEN', () => {
  it('formats positive amounts in es-PE locale with two decimal places and the S/ prefix', () => {
    expect(formatPEN(100)).toBe('S/ 100.00');
    expect(formatPEN(1234.5)).toBe('S/ 1,234.50');
    expect(formatPEN(0)).toBe('S/ 0.00');
  });
});
