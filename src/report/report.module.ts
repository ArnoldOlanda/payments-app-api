import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { CollectionsReportService } from './collections-report.service';
import { ReportController } from './report.controller';
import { PrinterModule } from '../printer/printer.module';
import { UserModule } from 'src/user/user.module';
import { ZoneModule } from 'src/zone/zone.module';
import { Payment } from 'src/payment/entities/payment.entity';

@Module({
  controllers: [ReportController],
  providers: [ReportService, CollectionsReportService],
  imports: [
    TypeOrmModule.forFeature([Payment]),
    PrinterModule,
    UserModule,
    ZoneModule,
  ],
})
export class ReportModule {}
