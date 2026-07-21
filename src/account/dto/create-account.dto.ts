import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { CreditType } from '../enums/credit-type.enum';
import { IsAfter } from '../decorators/is-after/is-after.decorator';

export class CreateAccountDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  customerId: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(Object.values(CreditType), {
    message: 'El tipo de credito no es valido',
  })
  creditType: CreditType;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  @IsAfter('date', {
    message:
      'La fecha de vencimiento no puede ser anterior a la fecha del credito',
  })
  dueDate: Date;

  @IsNotEmpty()
  @IsNumber()
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount: number;

  @IsNotEmpty()
  @IsNumber()
  interest: number;
}
