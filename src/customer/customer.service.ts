import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AccountService } from 'src/account/account.service';
import { Customer } from './entities/customer.entity';
import { Zone } from 'src/zone/entities/zone.entity';

@Injectable()
export class CustomerService {

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
    private readonly accountService: AccountService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    try {
      let zone = null;
      if (createCustomerDto.zoneId) {
        zone = await this.zoneRepository.findOne({ where: { id: createCustomerDto.zoneId } });
        if (!zone) 
          throw new NotFoundException(`Zone with id ${createCustomerDto.zoneId} not found`);
      }
      const customer = this.customerRepository.create({
        ...createCustomerDto,
        zone
      })

      const savedCustomer = await this.customerRepository.save(customer);
      return savedCustomer;
    } catch (error) {
      if(error.code === '23505') {
        throw new ConflictException('El correo o el documento ya esta en uso');
      }
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto) {
    if (!paginationDto.page && !paginationDto.limit) {
      return this.customerRepository.find({
        relations: ['zone']
      });
    }
    
    const { page, limit } = paginationDto;
    const skip = (page - 1) * limit;
    
    const [data, total] = await this.customerRepository.findAndCount({
      relations: ['zone'],
      skip,
      take: limit,
    });

    return {
      data,
      total
    };
  }

  async findOne(id: string) {
    const customer = await this.customerRepository.findOne({where: {id}});

    if (!customer) throw new NotFoundException('Customer not found');
    
    return customer;
  }

  async findCredits(id: string) {
    const customer = await this.customerRepository.findOne({
      where: {id},
      relations: ['accounts']
    });

    if (!customer) throw new NotFoundException('Customer not found');
    
    return customer.accounts;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const zone = await this.zoneRepository.findOne({where: {id: updateCustomerDto.zoneId}});

    if (!zone) throw new NotFoundException('Zone not found');
    
    const customer = await this.customerRepository.preload({
      id,
      ...updateCustomerDto,
      zone: zone ?? null
    });

    if (!customer) throw new NotFoundException('Customer not found');
    
    return await this.customerRepository.save(customer);
  }

  async remove(id: string) {
      const customer = await this.customerRepository.findOne({
        where: {id}, 
        relations:['accounts']
      });
    
      if (!customer) throw new NotFoundException('Customer not found');
      
      //Delete all accounts and payments 
      await Promise.all(
        customer.accounts.map(account => this.accountService.remove(account.id))
      );

      await this.customerRepository.softDelete(id);
    
      return 'Customer deleted successfully';
  }
}
