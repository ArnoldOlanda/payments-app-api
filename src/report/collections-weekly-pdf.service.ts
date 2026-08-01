import { Injectable } from '@nestjs/common';
import type PDFKit from 'pdfkit';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as _PDFKitNS from 'pdfkit';

import { PrinterService } from 'src/printer/printer.service';
import { ZoneService } from 'src/zone/zone.service';

import { collectionsWeeklyPdf } from './documents/collections-weekly-pdf';
import { CollectionsWeeklyQueryDto } from './dto/collections-weekly-query.dto';
import {
  CollectionsWeeklyReportService,
  WeeklyReportResponse,
} from './collections-weekly-report.service';

export interface CollectionsWeeklyPdfResult {
  doc: PDFKit.PDFDocument;
  weekStart: string;
  weekEnd: string;
  zoneName: string;
}

/**
 * Orchestrates the weekly collections PDF.
 *
 * Single call:
 *   1. `CollectionsWeeklyReportService.findOne(query, tz)` — single source of
 *      truth for the week's data, runs the query exactly once.
 *   2. `ZoneService.findOne(query.zoneId)` — surfaces 404 if the zone is
 *      missing; the controller maps that to a 404 response.
 *   3. `collectionsWeeklyPdf({ data, zoneName, tz })` — pure pdfmake doc.
 *   4. `printerService.createPdf(doc)` — returns a PDFKit.Document the
 *      controller streams to the HTTP response.
 *
 * The controller layer is responsible for the ADMIN role guard.
 */
@Injectable()
export class CollectionsWeeklyPdfService {
  constructor(
    private readonly weeklyReportService: CollectionsWeeklyReportService,
    private readonly zoneService: ZoneService,
    private readonly printerService: PrinterService,
  ) {}

  async generate(
    query: CollectionsWeeklyQueryDto,
    tz: string,
  ): Promise<CollectionsWeeklyPdfResult> {
    const data: WeeklyReportResponse = await this.weeklyReportService.findOne(
      query,
      tz,
    );

    const zone = await this.zoneService.findOne(query.zoneId);

    const docDefinition = collectionsWeeklyPdf({
      data,
      zoneName: zone.name,
      tz,
    });

    const doc = this.printerService.createPdf(docDefinition);

    return {
      doc,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      zoneName: zone.name,
    };
  }
}
