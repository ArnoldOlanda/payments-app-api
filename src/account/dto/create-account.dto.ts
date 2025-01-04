import { IsDate, IsIn, IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";
import { CreditType } from "../enums/credit-type.enum";

export class CreateAccountDto {

    @IsNotEmpty()
    @IsString()
    @IsUUID()
    customerId: string;

    @IsNotEmpty()
    @IsString()
    @IsIn(Object.values(CreditType))
    creditType: CreditType;

    @IsNotEmpty()
    @IsDate()
    date: Date;

    @IsNotEmpty()
    @IsDate()
    dueDate: Date;

    @IsNotEmpty()
    @IsNumber()
    amount: number;

    @IsNotEmpty()
    @IsNumber()
    interest: number;
}
