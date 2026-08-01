import { format as tempoFormat } from '@formkit/tempo';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

import { capitalize } from 'src/helpers/capitalize';
import { formatPEN } from 'src/report/collections-weekly-pdf.helpers';
import { WeeklyReportResponse } from 'src/report/collections-weekly-report.service';

export interface CollectionsWeeklyPdfInput {
  data: WeeklyReportResponse;
  zoneName: string;
  tz: string;
}

const TABLE_WIDTHS: ('auto' | '*')[] = [
  'auto', //  0 Nro
  '*', //  1 Apellidos y nombres
  'auto', //  2 Tipo Credito
  'auto', //  3 Fecha cred.
  'auto', //  4 Fecha venc.
  'auto', //  5 Monto
  'auto', //  6 Restante
  'auto', //  7  Lun
  'auto', //  8  Mar
  'auto', //  9  Mie
  'auto', // 10  Jue
  'auto', // 11  Vie
  'auto', // 12  Sab
  'auto', // 13  Dom
  'auto', // 14 Total sem.
];

function parseDayUtcNoon(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) {
    throw new Error(`Invalid calendar day (expected YYYY-MM-DD): ${day}`);
  }
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
}

function formatDayLabel(day: string, tz: string): string {
  return capitalize(
    tempoFormat({ date: parseDayUtcNoon(day), format: 'ddd DD', tz }),
  );
}

function dayCellText(amount: number | null): string {
  return amount === null ? '—' : formatPEN(amount);
}

function formatDateOrDash(isoDate: string | null, tz: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return tempoFormat({ date: d, format: 'DD/MM/YYYY', tz });
}

/**
 * Pure pdfmake document definition for the weekly collections report.
 *
 * Portrait A4, 15-column table, `headerRows: 1` so the header repeats on
 * page breaks. Reuses the visual style of `fichaReport` (Artidev header,
 * weekday columns, week-range subtitle) but does NOT import it; the
 * template is self-contained per the design decision.
 */
export const collectionsWeeklyPdf = (
  input: CollectionsWeeklyPdfInput,
): TDocumentDefinitions => {
  const { data, zoneName, tz } = input;

  const weekdayHeaders = data.days.map((d) => formatDayLabel(d.date, tz));
  const firstDay = data.days[0]?.date;
  const lastDay = data.days[data.days.length - 1]?.date;
  const weekRangeText =
    firstDay && lastDay
      ? `${tempoFormat({ date: parseDayUtcNoon(firstDay), format: 'D', tz })}-${tempoFormat(
          { date: parseDayUtcNoon(lastDay), format: 'D', tz },
        )} de ${capitalize(
          tempoFormat({ date: parseDayUtcNoon(firstDay), format: 'MMMM', tz }),
        )} de ${tempoFormat({ date: parseDayUtcNoon(firstDay), format: 'YYYY', tz })}`
      : '';

  return {
    pageOrientation: 'portrait',
    pageSize: 'A4',
    info: { title: 'Reporte Semanal de Cobranzas' },
    header: {
      text: 'Artidev',
      alignment: 'right',
      margin: [10, 10],
    },
    content: [
      {
        text: 'Reporte Semanal de Cobranzas',
        alignment: 'center',
        bold: true,
        fontSize: 16,
        margin: [0, 10, 0, 20],
      },
      {
        columns: [
          {
            text: `Zona: ${zoneName}`,
            alignment: 'left',
            bold: true,
            fontSize: 10,
          },
          {
            text: `Semana: ${weekRangeText}`,
            alignment: 'right',
            bold: true,
            fontSize: 10,
          },
        ],
      },
      {
        margin: [0, 10],
        fontSize: 8,
        table: {
          headerRows: 1,
          widths: TABLE_WIDTHS,
          body: [
            [
              'Nro',
              'Apellidos y nombres',
              'Tipo Credito',
              'Fecha cred.',
              'Fecha venc.',
              'Monto',
              'Restante',
              ...weekdayHeaders,
              'Total sem.',
            ],
            ...data.rows.map((row, idx) => [
              idx + 1,
              `${row.customer.lastName} ${row.customer.name}`.trim(),
              row.creditType,
              formatDateOrDash(row.accountDate, tz),
              formatDateOrDash(row.dueDate, tz),
              formatPEN(row.amount),
              formatPEN(row.remainingBalance),
              ...row.days.map((d) => dayCellText(d.amount)),
              formatPEN(row.weeklyTotal),
            ]),
            // Footer row: "Totales" label across the first 7 columns,
            // then one cell per day + grand total. The 7 empty cells are
            // required by pdfmake to render a 15-column row.
            [
              { text: 'Totales', colSpan: 7, alignment: 'right', bold: true },
              {},
              {},
              {},
              {},
              {},
              {},
              ...data.totals.byDay.map((d) => ({
                text: formatPEN(d.amount),
                bold: true,
              })),
              { text: formatPEN(data.totals.totalCollected), bold: true },
            ],
          ],
        },
      },
    ],
  };
};
