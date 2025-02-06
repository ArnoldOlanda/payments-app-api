import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from 'src/role/entities/role.entity';
import { Zone } from 'src/zone/entities/zone.entity';
import { Payment } from 'src/payment/entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Zone,
      Payment
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
