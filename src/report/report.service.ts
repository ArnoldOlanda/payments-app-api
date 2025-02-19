import { Injectable } from '@nestjs/common';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrinterService } from 'src/printer/printer.service';

@Injectable()
export class ReportService {

    constructor(private readonly printerService: PrinterService) {}

    async getFichaPagos() {
        const docDefinitions: TDocumentDefinitions = {
            pageOrientation: 'landscape',
            header: {
                text: 'Artidev',
                alignment:'right',
                margin: [10,10]
            },
            content: [
                {
                    text: 'Ficha de Pagos',
                    style: 'header',
                    alignment: 'center',
                    bold: true,
                    fontSize: 20,
                },
                {
                    margin: [0, 20],
                    table:{
                        widths:['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                        headerRows: 1,
                        body: [
                            ['Cliente', 'Monto', 'Fecha vencimiento', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Total'],
                            ['Arnold Olanda', 'S/ 1000', '2022-01-01', '', '', '', '', '', '', ''],
                            ['Ronald Torres', 'S/ 2000', '2022-01-01', '', '', '', '', '', '', ''],
                            ['Carlos Mamani', 'S/ 3000', '2022-01-01', '', '', '', '', '', '', ''],
                        ]
                    }
                }
            ],
        }

        return this.printerService.createPdf(docDefinitions);
    }
}
