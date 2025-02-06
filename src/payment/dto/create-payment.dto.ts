import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";

export class CreatePaymentDto {

    @IsNotEmpty()
    @IsString()
    @IsUUID()
    accountId: string;

    @IsNotEmpty()
    @IsString()
    @IsUUID()
    userId: string;

    @IsNotEmpty()
    @IsDate()
    @Type(() => Date)
    date: Date;

    @IsNotEmpty()
    @IsNumber()
    amount: number;
}
