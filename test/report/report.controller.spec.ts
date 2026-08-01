import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { ReportController } from 'src/report/report.controller';
import { ReportService } from 'src/report/report.service';
import { CollectionsReportService } from 'src/report/collections-report.service';
import { CollectionsWeeklyReportService } from 'src/report/collections-weekly-report.service';
import { CollectionsWeeklyPdfService } from 'src/report/collections-weekly-pdf.service';
import { ValidRole } from 'src/auth/enums/validRoles.enum';

const ZONE_ID = '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3b';

function makePdfDoc(chunks: string[] = ['PDF-CHUNK']): any {
  let capturedTarget: any = null;
  const doc: any = {
    info: {},
    pipe: jest.fn((target: any) => {
      capturedTarget = target;
      for (const c of chunks) {
        target.write(c);
      }
    }),
    end: jest.fn(() => {
      if (capturedTarget && typeof capturedTarget.end === 'function') {
        capturedTarget.end();
      }
    }),
  };
  return doc;
}

describe('ReportController — GET /report/collections/weekly/pdf', () => {
  let app: INestApplication;
  let fakeUserRole: string = ValidRole.ADMIN;
  let pdfGenerate: jest.Mock;

  beforeEach(async () => {
    fakeUserRole = ValidRole.ADMIN;
    const doc = makePdfDoc();
    pdfGenerate = jest.fn().mockResolvedValue({
      doc,
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12',
      zoneName: 'Zone A',
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        { provide: ReportService, useValue: {} },
        { provide: CollectionsReportService, useValue: {} },
        {
          provide: CollectionsWeeklyReportService,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: CollectionsWeeklyPdfService,
          useValue: { generate: pdfGenerate },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'u-1', role: fakeUserRole, timezone: 'UTC' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with application/pdf, a sanitized Content-Disposition filename, and pipes the PDF body chunks', async () => {
    const doc = makePdfDoc(['PDF-CHUNK-A', 'PDF-CHUNK-B']);
    pdfGenerate.mockResolvedValueOnce({
      doc,
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12',
      zoneName: 'Zone A',
    });

    const res = await request(app.getHttpServer())
      .get('/report/collections/weekly/pdf')
      .query({ weekStart: '2026-07-06', zoneId: ZONE_ID })
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="reporte-cobranzas-zone-a-2026-07-06-2026-07-12\.pdf"$/,
    );
    expect(doc.pipe).toHaveBeenCalledTimes(1);
    expect(doc.end).toHaveBeenCalledTimes(1);
    const pipeTarget = doc.pipe.mock.calls[0][0];
    expect(pipeTarget).toBeDefined();
    expect(typeof pipeTarget.write).toBe('function');
    expect(pdfGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart: '2026-07-06', zoneId: ZONE_ID }),
      'UTC',
    );
  });

  it('returns 403 Forbidden for non-ADMIN actors and does not invoke the PDF service', async () => {
    fakeUserRole = 'Cobrador';

    await request(app.getHttpServer())
      .get('/report/collections/weekly/pdf')
      .query({ weekStart: '2026-07-06', zoneId: ZONE_ID })
      .expect(403);

    expect(pdfGenerate).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when weekStart does not match YYYY-MM-DD', async () => {
    await request(app.getHttpServer())
      .get('/report/collections/weekly/pdf')
      .query({ weekStart: '07-06-2026', zoneId: ZONE_ID })
      .expect(400);
    expect(pdfGenerate).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when zoneId is not a UUID', async () => {
    await request(app.getHttpServer())
      .get('/report/collections/weekly/pdf')
      .query({ weekStart: '2026-07-06', zoneId: 'not-a-uuid' })
      .expect(400);
    expect(pdfGenerate).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when userId is provided but is not a UUID', async () => {
    await request(app.getHttpServer())
      .get('/report/collections/weekly/pdf')
      .query({ weekStart: '2026-07-06', zoneId: ZONE_ID, userId: 'abc' })
      .expect(400);
    expect(pdfGenerate).not.toHaveBeenCalled();
  });

  it('embeds a non-empty PDF title on the generated document', async () => {
    const doc = makePdfDoc();
    pdfGenerate.mockResolvedValueOnce({
      doc,
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12',
      zoneName: 'Zone A',
    });

    await request(app.getHttpServer())
      .get('/report/collections/weekly/pdf')
      .query({ weekStart: '2026-07-06', zoneId: ZONE_ID })
      .expect(200);

    expect(doc.info.Title).toBeTruthy();
    expect(String(doc.info.Title).length).toBeGreaterThan(0);
  });
});
