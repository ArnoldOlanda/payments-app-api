import { PartialType } from '@nestjs/mapped-types';
import { CreateCreditTypeDto } from './create-credit-type.dto';

export class UpdateCreditTypeDto extends PartialType(CreateCreditTypeDto) {}
