import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { AccountStatus } from "../enums/account-status.enum";


export class PaginateAccountDto {
    @IsEnum(AccountStatus, {message: 'The valid values are active, finished, cancelled, overdue'})
    status: AccountStatus;
    
    @IsOptional()
    @IsUUID('4')
    zoneId?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @IsNumber()
    @Min(1)
    limit?: number = 10;

    //TODO: Add more filters
    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsString()
    order?: 'ASC' | 'DESC';

    @IsOptional()
    @IsString()
    search?: string;

}