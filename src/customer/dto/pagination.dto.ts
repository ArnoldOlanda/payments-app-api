import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsUUID, Min, IsString } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  all?: boolean;

  @IsOptional()
  @IsUUID('4')
  zoneId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
