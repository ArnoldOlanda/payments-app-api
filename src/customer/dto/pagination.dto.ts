import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ToBoolean } from 'src/common/decorators/to-boolean.decorator';

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
  @ToBoolean()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsUUID('4')
  zoneId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
