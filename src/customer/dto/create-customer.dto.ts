import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.documentNumber && o.documentNumber.length > 0)
  @Length(8, 10)
  documentNumber?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.phone && o.phone.length > 0)
  @Length(9, 15, { message: 'El número de teléfono debe tener 9 caracteres' })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  zoneId?: string;
}
