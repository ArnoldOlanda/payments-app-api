import { PartialType } from '@nestjs/mapped-types';
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @ValidateIf(
    (o) => typeof o.password === 'string' && o.password.length > 0,
  )
  @IsString()
  @MinLength(8)
  password?: string;
}
