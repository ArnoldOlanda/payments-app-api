import { fichaReport } from 'src/report/documents/ficha.report';

/**
 * Verifies that fichaReport forwards the actor TZ to the pdfmake date
 * formatter. We can't easily read the rendered PDF, so we assert on the
 * document definition's `content` array which embeds the formatted strings.
 */
describe('fichaReport — TZ-aware PDF date formatting', () => {
  const baseDaysWeek = [
    new Date('2025-06-15T15:00:00.000Z'), // Sun Jun 16 in Tokyo
    new Date('2025-06-16T15:00:00.000Z'), // Mon Jun 16 in Tokyo (start of week)
    new Date('2025-06-17T15:00:00.000Z'),
    new Date('2025-06-18T15:00:00.000Z'),
    new Date('2025-06-19T15:00:00.000Z'),
    new Date('2025-06-20T15:00:00.000Z'),
    new Date('2025-06-21T15:00:00.000Z'),
  ];

  it('formats the header date (month + year) in the actor TZ', () => {
    const doc = fichaReport({
      user: 'Test User',
      zone: 'Zone A',
      daysWeek: baseDaysWeek,
      accounts: [],
      tz: 'Asia/Tokyo',
    });

    // Walk the content tree and gather any text matching a YYYY token.
    const allText = JSON.stringify(doc.content);
    // June 2025 in Tokyo — yearName should be '2025'.
    expect(allText).toContain('2025');
    // The Spanish month name for June in Tokyo TZ.
    expect(allText.toLowerCase()).toContain('junio');
  });

  it('uses different formatting when TZ changes (Tokyo vs Buenos Aires)', () => {
    const docTokyo = fichaReport({
      user: 'Test User',
      zone: 'Zone A',
      daysWeek: baseDaysWeek,
      accounts: [],
      tz: 'Asia/Tokyo',
    });
    const docBA = fichaReport({
      user: 'Test User',
      zone: 'Zone A',
      daysWeek: baseDaysWeek,
      accounts: [],
      tz: 'America/Argentina/Buenos_Aires',
    });

    // The day labels differ across TZ boundaries — Tokyo and BA fall on
    // different calendar days for the same UTC instant.
    expect(JSON.stringify(docTokyo.content)).not.toBe(
      JSON.stringify(docBA.content),
    );
  });

  it('renders missing account dates without failing the PDF', () => {
    const doc = fichaReport({
      user: 'Test User',
      zone: 'Zone A',
      daysWeek: baseDaysWeek,
      accounts: [
        {
          customer: { name: 'Ada', lastName: 'Lovelace' },
          creditType: 'Diario',
          date: null,
          dueDate: null,
          amount: 100,
          remainingBalance: 50,
        },
      ],
      tz: 'Asia/Tokyo',
    });

    expect(JSON.stringify(doc.content)).toContain('—');
  });

  it('formats account dates in the actor TZ', () => {
    const doc = fichaReport({
      user: 'Test User',
      zone: 'Zone A',
      daysWeek: baseDaysWeek,
      accounts: [
        {
          customer: { name: 'Ada', lastName: 'Lovelace' },
          creditType: 'Diario',
          date: new Date('2025-06-16T15:00:00.000Z'),
          dueDate: new Date('2025-06-17T15:00:00.000Z'),
          amount: 100,
          remainingBalance: 50,
        },
      ],
      tz: 'Asia/Tokyo',
    });

    const content = JSON.stringify(doc.content);
    expect(content).toContain('17/06/2025');
    expect(content).toContain('18/06/2025');
  });
});
