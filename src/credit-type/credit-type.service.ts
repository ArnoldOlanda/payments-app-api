import { Injectable } from '@nestjs/common';
import { CreateCreditTypeDto } from './dto/create-credit-type.dto';
import { UpdateCreditTypeDto } from './dto/update-credit-type.dto';

@Injectable()
export class CreditTypeService {
  create(createCreditTypeDto: CreateCreditTypeDto) {
    return 'This action adds a new creditType';
  }

  findAll() {
    return `This action returns all creditType`;
  }

  findOne(id: number) {
    return `This action returns a #${id} creditType`;
  }

  update(id: number, updateCreditTypeDto: UpdateCreditTypeDto) {
    return `This action updates a #${id} creditType`;
  }

  remove(id: number) {
    return `This action removes a #${id} creditType`;
  }
}
