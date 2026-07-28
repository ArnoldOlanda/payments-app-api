import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsBoolean()
  closeWithOverpayment?: boolean;
}
