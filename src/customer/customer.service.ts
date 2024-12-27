import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Repository } from 'typeorm';
import { Zone } from 'src/zone/entities/zone.entity';

@Injectable()
export class CustomerService {

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    try {
      const zone = await this.zoneRepository.findOne({where: {id: createCustomerDto.zone_id}});
      
      const customer = this.customerRepository.create({
        ...createCustomerDto,
        zone: zone ?? null
      })

      const savedCustomer = await this.customerRepository.save(customer);
      return savedCustomer;
    } catch (error) {
      if(error.code === '23505') {
        throw new ConflictException('Email or document number already exists');
      }
      throw error;
    }
  }

  findAll() {
    return this.customerRepository.find();
  }

  async findOne(id: string) {
    const customer = await this.customerRepository.findOne({where: {id}});

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const zone = await this.zoneRepository.findOne({where: {id: updateCustomerDto.zone_id}});

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    const customer = await this.customerRepository.preload({
      id,
      ...updateCustomerDto,
      zone: zone ?? null
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return await this.customerRepository.save(customer);
  }

  async remove(id: string) {
      const customer = await this.customerRepository.findOne({where: {id}});
    
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      await this.customerRepository.softDelete(id);

      return 'Customer deleted successfully';
  }
}
