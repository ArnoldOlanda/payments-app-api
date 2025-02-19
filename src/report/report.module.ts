import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { PrinterModule } from '../printer/printer.module';

@Module({
  controllers: [ReportController],
  providers: [ReportService],
  imports: [PrinterModule],
})
export class ReportModule {}
