import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsUUID } from 'class-validator';

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
}
