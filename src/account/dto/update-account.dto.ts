import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;
}
