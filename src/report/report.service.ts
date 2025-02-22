import { Injectable } from '@nestjs/common';
import { PrinterService } from 'src/printer/printer.service';
import { fichaReport } from './documents/ficha.report';

@Injectable()
export class ReportService {

    constructor(private readonly printerService: PrinterService) {}

    async getFichaPagos() {
        const docDefinitions= fichaReport();

        return this.printerService.createPdf(docDefinitions);
    }
}
