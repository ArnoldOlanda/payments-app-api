import { Controller, Get, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { Response } from 'express';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('/ficha-pagos')
  async getFichaPagos(
    @Res() response: Response
  ) {
    response.setHeader('Content-Type', 'application/pdf');
    const pdfDoc = await this.reportService.getFichaPagos();
    
    pdfDoc.info.Title = 'Ficha de Pagos';
    pdfDoc.pipe(response);
    pdfDoc.end();
  }
}
