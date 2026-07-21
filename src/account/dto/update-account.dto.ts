import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
import { IsNumber, Min } from 'class-validator';

export class UpdateAccountDto extends PartialType(
  OmitType(CreateAccountDto, [
    'date',
    'creditType',
    'customerId',
    'interest',
  ] as const),
) {
  @IsNumber()
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount?: number;
}
