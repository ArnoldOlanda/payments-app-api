import { format } from "@formkit/tempo";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import { capitalize } from "src/helpers/capitalize";

interface PDFData{
    user: string;
    zone: string;
    daysWeek: Date[];
    accounts: any[];
}

export const fichaReport = (data: PDFData):TDocumentDefinitions =>{
    
    
    const datesFormated = data.daysWeek.map(d=>capitalize(format(d, 'ddd DD','es-ES')));
    const dateNumberStart = format(data.daysWeek[0], 'D', 'es-ES');
    const dateNumberEnd = format(data.daysWeek[data.daysWeek.length-1], 'D', 'es-ES');
    const monthName = capitalize(format(data.daysWeek[0], 'MMMM','es-ES'));
    const yearName = format(data.daysWeek[0], 'YYYY','es-ES');

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
                        text: 'Zona: ' + data.zone,
                        style: 'header',
                        alignment: 'left',
                        bold: true,
                        fontSize: 12,
                    },
                    {
                        text: `Semana: ${dateNumberStart}-${dateNumberEnd} de ${monthName} de ${yearName}`,
                        style: 'header',
                        alignment: 'right',
                        bold: true,
                        fontSize: 12,
                    }
                ]
            },
            {
                text: 'Usuario: ' + data.user,
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
                        ['Nro','Apellidos y nombres', 'Tipo Credito', 'Fecha cred.', 'Fecha venc.', 'Monto', 'Restante', ...datesFormated],
                        ...data.accounts.map((a,i)=>{
                            return [
                                i+1,
                                a.customer.name + ' ' + a.customer.lastName,
                                a.creditType,
                                format(a.date, 'DD/MM/YYYY'),
                                format(a.dueDate, 'DD/MM/YYYY'),
                                `S/ ${a.amount}`,
                                `S/ ${a.remainingBalance}`,
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                ''
                            ]
                        }),
                        // ['1','Arnold Olanda', 'Diario','22/02/2025', '22/03/2025', 'S/ 1000', 'S/ 500',  '', '', '', '', '', '', '']
                        
                    ]
                }
            }
        ],
    }
}