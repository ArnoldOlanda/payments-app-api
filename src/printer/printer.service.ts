import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

const fonts = {
    Roboto: {
        normal: 'fonts/Roboto-Regular.ttf',
        bold: 'fonts/Roboto-Bold.ttf',
        italic: 'fonts/Roboto-Italic.ttf',
        boldItalic: 'fonts/Roboto-BoldItalic.ttf',
    },
}

@Injectable()
export class PrinterService {
    private printer = new PdfPrinter(fonts);

    createPdf(docDefinitions: TDocumentDefinitions) {
        return this.printer.createPdfKitDocument(docDefinitions);
    }

}
