import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Zone } from 'src/zone/entities/zone.entity';
import { Customer } from './entities/customer.entity';
import { Account } from 'src/account/entities/account.entity';
import { AccountModule } from 'src/account/account.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Zone]), AccountModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
