import { format } from '@formkit/tempo';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { capitalize } from 'src/helpers/capitalize';

interface PDFData {
  user: string;
  zone: string;
  daysWeek: Date[];
  accounts: any[];
  tz: string;
}

export const fichaReport = (data: PDFData): TDocumentDefinitions => {
  const f = (d: Date, fmt: string) =>
    format({ date: d, format: fmt, locale: 'es-ES', tz: data.tz });
  const safeFormat = (d: Date | null | undefined, fmt: string) =>
    d instanceof Date && !Number.isNaN(d.getTime()) ? f(d, fmt) : '—';
  const datesFormated = data.daysWeek.map((d) => capitalize(f(d, 'ddd DD')));
  const dateNumberStart = f(data.daysWeek[0], 'D');
  const dateNumberEnd = f(data.daysWeek[data.daysWeek.length - 1], 'D');
  const monthName = capitalize(f(data.daysWeek[0], 'MMMM'));
  const yearName = f(data.daysWeek[0], 'YYYY');

  return {
    pageOrientation: 'portrait',
    header: {
      text: 'Artidev',
      alignment: 'right',
      margin: [10, 10],
    },
    content: [
      {
        text: 'Ficha de Pagos',
        style: 'header',
        alignment: 'center',
        bold: true,
        fontSize: 16,
        margin: [0, 10, 0, 20],
      },
      {
        columns: [
          {
            text: 'Zona: ' + data.zone,
            style: 'header',
            alignment: 'left',
            bold: true,
            fontSize: 10,
          },
          {
            text: `Semana: ${dateNumberStart}-${dateNumberEnd} de ${monthName} de ${yearName}`,
            style: 'header',
            alignment: 'right',
            bold: true,
            fontSize: 10,
          },
        ],
      },
      {
        text: 'Usuario: ' + data.user,
        bold: true,
        fontSize: 10,
      },
      {
        margin: [0, 10],
        fontSize: 8,
        table: {
          widths: [
            'auto',
            '*',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
          ],
          headerRows: 1,
          heights: 20,
          body: [
            [
              'Nro',
              'Apellidos y nombres',
              'Tipo Credito',
              'Fecha cred.',
              'Fecha venc.',
              'Monto',
              'Restante',
              ...datesFormated,
            ],
            ...data.accounts.map((a, i) => {
              return [
                i + 1,
                a.customer.name + ' ' + a.customer.lastName,
                a.creditType,
                safeFormat(a.date, 'DD/MM/YYYY'),
                safeFormat(a.dueDate, 'DD/MM/YYYY'),
                `S/\u00A0${a.amount}`,
                `S/\u00A0${a.remainingBalance}`,
                '\u00A0',
                '\u00A0',
                '\u00A0',
                '\u00A0',
                '\u00A0',
                '\u00A0',
                '\u00A0',
              ];
            }),
            // 4 blank rows for the cobrador to fill in manually.
            ...Array(4).fill([
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
            ]),
            // Totales row
            [
              { text: 'Totales', colSpan: 7, alignment: 'right', bold: true },
              {},
              {},
              {},
              {},
              {},
              {},
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
              '\u00A0',
            ],
          ],
        },
      },
    ],
  };
};
