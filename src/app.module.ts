import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { dataSource } from './config/data-source';
import { RoleModule } from './role/role.module';
import { ZoneModule } from './zone/zone.module';
import { CustomerModule } from './customer/customer.module';
import { AccountModule } from './account/account.module';
import { PaymentModule } from './payment/payment.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { FilesModule } from './files/files.module';
import { ReportModule } from './report/report.module';
import { PrinterModule } from './printer/printer.module';
import { MailModule } from './mail/mail.module';
import { AnalyticsModule } from './analytics/analytics.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 1000 * 60 * 60 * 24, // 1 day in milliseconds
    }),
    TypeOrmModule.forRoot(dataSource),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 20, // default global limit: 20 req/min per IP
        },
      ],
    }),
    UserModule,
    RoleModule,
    ZoneModule,
    CustomerModule,
    AccountModule,
    PaymentModule,
    AuthModule,
    SeedModule,
    FilesModule,
    ReportModule,
    PrinterModule,
    MailModule,
    AnalyticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
