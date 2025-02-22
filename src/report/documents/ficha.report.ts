import { TDocumentDefinitions } from "pdfmake/interfaces";

export const fichaReport = ():TDocumentDefinitions =>{
    return {
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
                margin: [0, 10, 0, 20]
            },
            {
                columns: [
                    {
                        text: 'Zona: Zona 1',
                        style: 'header',
                        alignment: 'left',
                        bold: true,
                        fontSize: 12,
                    },
                    {
                        text: 'Semana: 10-16 de Febrero de 2025',
                        style: 'header',
                        alignment: 'right',
                        bold: true,
                        fontSize: 12,
                    }
                ]
            },
            {
                text: 'Usuario: Arnold Olanda',
                bold: true,
                fontSize: 12,
            },
            {
                margin: [0, 10],
                fontSize: 10,
                table:{
                    
                    widths:['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                    headerRows: 1,
                    body: [
                        ['Nro','Apellidos y nombres', 'Tipo Credito', 'Fecha cred.', 'Fecha venc.', 'Monto', 'Restante', 'Lun 10', 'Mar 11', 'Mié 12', 'Jue 13', 'Vie 14', 'Sáb 15', 'Dom 16'],
                        ['1','Arnold Olanda', 'Diario','22/02/2025', '22/03/2025', 'S/ 1000', 'S/ 500',  '', '', '', '', '', '', '']
                        
                    ]
                }
            }
        ],
    }
}