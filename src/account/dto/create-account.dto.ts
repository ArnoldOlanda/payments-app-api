import { IsDate, IsIn, IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";
import { CreditType } from "../enums/credit-type.enum";
import { IsAfter } from "../decorators/is-after/is-after.decorator";

export class CreateAccountDto {

    @IsNotEmpty()
    @IsString()
    @IsUUID()
    customerId: string;

    @IsNotEmpty()
    @IsString()
    @IsIn(Object.values(CreditType),{message: 'El tipo de credito no es valido'})
    creditType: CreditType;

    @IsNotEmpty()
    @IsDate()
    date: Date;

    @IsNotEmpty()
    @IsDate()
    @IsAfter('date',{message: 'La fecha de vencimiento no puede ser anterior a la fecha del credito'})
    dueDate: Date;

    @IsNotEmpty()
    @IsNumber()
    amount: number;

    @IsNotEmpty()
    @IsNumber()
    interest: number;
}
