import { Injectable } from '@nestjs/common';
import { PrinterService } from 'src/printer/printer.service';
import { fichaReport } from './documents/ficha.report';
import { addDay, weekEnd, weekStart } from '@formkit/tempo';
import { Request } from 'express';
import { AccountService } from 'src/account/account.service';
import { UserService } from '../user/user.service';
import { ZoneService } from 'src/zone/zone.service';

@Injectable()
export class ReportService {

    constructor(
        private readonly printerService: PrinterService,
        private readonly userService: UserService,
        private readonly zoneService: ZoneService,
    ) {}

    
    async getDaysWeek(){
        const start = weekStart(new Date(), 1);
        const end = weekEnd(new Date(), 1);

        const diasSemana = [];
        let diaActual = start;

        while (diaActual <= end) {
        diasSemana.push(new Date(diaActual)); // Agrega una copia del día
        diaActual = addDay(diaActual, 1);       // Avanza un día
        }

        
        return diasSemana;
    }

    async getFichaPagos(request: Request, zoneId: string) {
        
        //@ts-ignore
        const id = request.user.id;
        //@ts-ignore
        const name = request.user.name;

        const zone = await this.zoneService.findOne(zoneId);

        const accounts = await this.userService.getAccounts(id, zoneId);
        
        const daysWeek = await this.getDaysWeek();
        const docDefinitions= fichaReport({
            user: name,
            zone: zone.name,
            daysWeek, 
            accounts
        });

        return this.printerService.createPdf(docDefinitions);
    }
}
