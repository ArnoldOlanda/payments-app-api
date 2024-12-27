import { IsEmail, IsNotEmpty, IsString, IsUUID } from "class-validator";

export class CreateUserDto {
    
    @IsNotEmpty()
    @IsString()
    @IsUUID()
    role_id: string;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;
}
