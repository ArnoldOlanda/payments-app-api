import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreateCustomerDto {
    
    @IsNotEmpty()
    @IsString()
    @Length(8,8)
    documentNumber: string;

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
    @Length(9,15,{message: 'El número de teléfono debe tener 9 caracteres'})
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
