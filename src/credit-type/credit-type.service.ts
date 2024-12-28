import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCreditTypeDto } from './dto/create-credit-type.dto';
import { UpdateCreditTypeDto } from './dto/update-credit-type.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditType } from './entities/credit-type.entity';

@Injectable()
export class CreditTypeService {

  constructor(
    @InjectRepository(CreditType)
    private readonly creditTypeRepository: Repository<CreditType>,
  ) {}

  create(createCreditTypeDto: CreateCreditTypeDto) {
    return this.creditTypeRepository.save(createCreditTypeDto);
  }

  findAll() {
    return this.creditTypeRepository.find();
  }

  async findOne(id: string) {
    const creditType = await this.creditTypeRepository.findOne({where: {id}});
    if (!creditType) {
      throw new NotFoundException(`CreditType with id ${id} not found`);
    }
    return creditType;
  }

  async update(id: string, updateCreditTypeDto: UpdateCreditTypeDto) {
    const creditType = await this.creditTypeRepository.preload({
      id,
      ...updateCreditTypeDto
    })

    if (!creditType) {
      throw new NotFoundException(`CreditType with id ${id} not found`);
    }
    return this.creditTypeRepository.save(creditType);
  }

  async remove(id: string) {
    try {
      await this.findOne(id);
      await this.creditTypeRepository.softDelete(id);
      
      return 'CreditType deleted successfully';
    
    } catch (error) {
      if(error instanceof NotFoundException) {
        throw new NotFoundException(`CreditType with id ${id} not found`);
      }
      throw error;
    }
  }
}
