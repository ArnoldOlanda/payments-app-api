import { Controller, Get, Req, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { Request, Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('/ficha-pagos')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  async getFichaPagos(
    @Req() request: Request,
    @Res() response: Response
  ) {
    response.setHeader('Content-Type', 'application/pdf');
    const pdfDoc = await this.reportService.getFichaPagos(request);
    
    pdfDoc.info.Title = 'Ficha de Pagos';
    pdfDoc.pipe(response);
    pdfDoc.end();
  }
}
