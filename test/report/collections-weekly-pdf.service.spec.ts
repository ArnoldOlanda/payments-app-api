import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type PDFKit from 'pdfkit';

import { CollectionsWeeklyPdfService } from 'src/report/collections-weekly-pdf.service';
import { CollectionsWeeklyReportService } from 'src/report/collections-weekly-report.service';
import { ZoneService } from 'src/zone/zone.service';
import { PrinterService } from 'src/printer/printer.service';

const ZONE_ID = '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3b';
const USER_ID = '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3a';

function buildWeeklyData(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function makePdfDoc(): any {
  return {
    info: {},
    pipe: jest.fn(),
    end: jest.fn(),
  };
}

describe('CollectionsWeeklyPdfService', () => {
  let findOne: jest.Mock;
  let zoneFindOne: jest.Mock;
  let createPdf: jest.Mock;
  let pdfDoc: PDFKit.PDFDocument;
  let service: CollectionsWeeklyPdfService;

  beforeEach(async () => {
    findOne = jest.fn().mockResolvedValue(buildWeeklyData());
    zoneFindOne = jest.fn().mockResolvedValue({ id: ZONE_ID, name: 'Zone A' });
    pdfDoc = makePdfDoc();
    createPdf = jest.fn().mockReturnValue(pdfDoc);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsWeeklyPdfService,
        {
          provide: CollectionsWeeklyReportService,
          useValue: { findOne },
        },
        {
          provide: ZoneService,
          useValue: { findOne: zoneFindOne },
        },
        {
          provide: PrinterService,
          useValue: { createPdf },
        },
      ],
    }).compile();

    service = module.get(CollectionsWeeklyPdfService);
  });

  it('forwards the query and timezone to CollectionsWeeklyReportService.findOne exactly once', async () => {
    const query = { weekStart: '2026-07-08', zoneId: ZONE_ID, userId: USER_ID };

    await service.generate(query, 'America/Argentina/Buenos_Aires');

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith(
      query,
      'America/Argentina/Buenos_Aires',
    );
  });

  it('returns the PDFKit document produced by printer.createPdf', async () => {
    const result = await service.generate(
      { weekStart: '2026-07-06', zoneId: ZONE_ID },
      'UTC',
    );

    expect(result.doc).toBe(pdfDoc);
    expect(createPdf).toHaveBeenCalledTimes(1);
    const docDef = createPdf.mock.calls[0][0];
    expect(docDef).toBeDefined();
    expect(docDef.pageOrientation).toBe('landscape');
  });

  it('resolves the zone through ZoneService.findOne with the queried zoneId', async () => {
    await service.generate({ weekStart: '2026-07-06', zoneId: ZONE_ID }, 'UTC');

    expect(zoneFindOne).toHaveBeenCalledTimes(1);
    expect(zoneFindOne).toHaveBeenCalledWith(ZONE_ID);
  });

  it('propagates the NotFoundException thrown by ZoneService.findOne when the zone is missing', async () => {
    const notFound = new NotFoundException(`Zone ${ZONE_ID} not found`);
    zoneFindOne.mockRejectedValueOnce(notFound);

    await expect(
      service.generate({ weekStart: '2026-07-06', zoneId: ZONE_ID }, 'UTC'),
    ).rejects.toBe(notFound);
    expect(createPdf).not.toHaveBeenCalled();
  });

  it('surfaces the normalized week boundaries on the returned envelope', async () => {
    findOne.mockResolvedValueOnce(
      buildWeeklyData({ weekStart: '2026-07-06', weekEnd: '2026-07-12' }),
    );

    const result = await service.generate(
      { weekStart: '2026-07-08', zoneId: ZONE_ID },
      'UTC',
    );

    expect(result.weekStart).toBe('2026-07-06');
    expect(result.weekEnd).toBe('2026-07-12');
    expect(result.zoneName).toBe('Zone A');
  });

  it('does not import the legacy fichaReport helper', () => {
    const fs = jest.requireActual('fs') as typeof import('fs');
    const path = jest.requireActual('path') as typeof import('path');
    const sourcePath = path.join(
      __dirname,
      '..',
      '..',
      'src',
      'report',
      'collections-weekly-pdf.service.ts',
    );
    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*ficha\.report/);
    expect(source).not.toMatch(/\bfichaReport\b/);
  });
});
