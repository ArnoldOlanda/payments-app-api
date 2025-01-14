import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from './config/data-source';
import { RoleModule } from './role/role.module';
import { ZoneModule } from './zone/zone.module';
import { CustomerModule } from './customer/customer.module';
import { AccountModule } from './account/account.module';
import { PaymentModule } from './payment/payment.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(dataSource), 
    UserModule, RoleModule, ZoneModule, CustomerModule, AccountModule, PaymentModule, AuthModule, SeedModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
