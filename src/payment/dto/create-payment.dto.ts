import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  accountId: string;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsBoolean()
  closeWithOverpayment?: boolean;
}
