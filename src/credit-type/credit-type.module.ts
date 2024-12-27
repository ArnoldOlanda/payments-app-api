import { Module } from '@nestjs/common';
import { CreditTypeService } from './credit-type.service';
import { CreditTypeController } from './credit-type.controller';

@Module({
  controllers: [CreditTypeController],
  providers: [CreditTypeService],
})
export class CreditTypeModule {}
