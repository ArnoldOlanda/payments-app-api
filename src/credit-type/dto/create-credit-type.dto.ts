import { IsNotEmpty, IsString } from "class-validator";

export class CreateCreditTypeDto {

    @IsNotEmpty()
    @IsString()
    name: string;
}
