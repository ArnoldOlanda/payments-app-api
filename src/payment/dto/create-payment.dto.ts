import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';

/**
 * Custom transformer for the `date` field.
 */
const toRequiredDate = ({ value }: { value: unknown }): unknown => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  accountId: string;

  @Transform(toRequiredDate)
  @IsNotEmpty({ message: 'date is required and must be a valid ISO date' })
  @IsDate({ message: 'date is required and must be a valid ISO date' })
  date: Date;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsBoolean()
  closeWithOverpayment?: boolean;
}
