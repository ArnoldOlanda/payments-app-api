import { IsDate, IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";

export class CreatePaymentDto {

    @IsNotEmpty()
    @IsString()
    @IsUUID()
    accountId: string;

    @IsNotEmpty()
    @IsDate()
    date: Date;

    @IsNotEmpty()
    @IsNumber()
    amount: number;
}
