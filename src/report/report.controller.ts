import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { CollectionsReportService } from './collections-report.service';
import { CollectionsWeeklyReportService } from './collections-weekly-report.service';
import { CollectionsReportQueryDto } from './dto/collections-report-query.dto';
import { CollectionsWeeklyQueryDto } from './dto/collections-weekly-query.dto';
import { Request, Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { CurrentTimezone } from 'src/auth/decorators/current-timezone.decorator';

@Controller('report')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly collectionsReportService: CollectionsReportService,
    private readonly collectionsWeeklyReportService: CollectionsWeeklyReportService,
  ) {}

  @Get('/ficha-pagos')
  @Auth(ValidRole.ADMIN)
  async getFichaPagos(
    @Req() request: Request,
    @Res() response: Response,
    @Query('zoneId') zoneId: string,
    @CurrentTimezone() tz: string,
  ) {
    response.setHeader('Content-Type', 'application/pdf');
    const pdfDoc = await this.reportService.getFichaPagos(request, zoneId, tz);

    pdfDoc.info.Title = 'Ficha de Pagos';
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/collections')
  @Auth(ValidRole.ADMIN)
  getCollectionsReport(
    @Query() query: CollectionsReportQueryDto,
    @CurrentTimezone() tz: string,
  ) {
    return this.collectionsReportService.findAll(query, tz);
  }

  @Get('/collections/weekly')
  @Auth(ValidRole.ADMIN)
  getCollectionsWeeklyReport(
    @Query() query: CollectionsWeeklyQueryDto,
    @CurrentTimezone() tz: string,
  ) {
    return this.collectionsWeeklyReportService.findOne(query, tz);
  }
}
