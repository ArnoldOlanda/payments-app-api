import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { Request, Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { CurrentTimezone } from 'src/auth/decorators/current-timezone.decorator';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

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
}
