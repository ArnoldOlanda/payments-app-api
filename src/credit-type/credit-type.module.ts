import { Module } from '@nestjs/common';
import { CreditTypeService } from './credit-type.service';
import { CreditTypeController } from './credit-type.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditType } from 'src/credit-type/entities/credit-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditType
    ])
  ],
  controllers: [CreditTypeController],
  providers: [CreditTypeService],
})
export class CreditTypeModule {}
