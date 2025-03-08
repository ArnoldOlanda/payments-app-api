import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { PrinterModule } from '../printer/printer.module';
import { AccountModule } from 'src/account/account.module';
import { UserModule } from 'src/user/user.module';
import { ZoneModule } from 'src/zone/zone.module';

@Module({
  controllers: [ReportController],
  providers: [ReportService],
  imports: [PrinterModule, UserModule, ZoneModule],
})
export class ReportModule {}
