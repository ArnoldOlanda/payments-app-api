import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { AccountStatus } from './enums/account-status.enum';
import { PaginateAccountDto } from './dto/paginate-account.dto';
import { Payment } from 'src/payment/entities/payment.entity';

@Injectable()
export class AccountService {
  
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async create(createAccountDto: CreateAccountDto) {
    const { customerId, amount } = createAccountDto;

    const customer = await this.customerRepository.findOne({where: {id: customerId}});
    if(!customer) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }
    const account = this.accountRepository.create({
      ...createAccountDto,
      remainingBalance: amount,
      customer,
    });

    return this.accountRepository.save(account);
  }

  async findAll({ zoneId, status, page, limit, search, order, sortBy }: PaginateAccountDto) {

    const skip = (page - 1) * limit;
    const query = this.accountRepository.createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone');


    if(status) {
      query.where('account.status = :status', {status});
    }

    if(zoneId) {
      query.andWhere('zone.id = :zoneId', {zoneId});
    }


    // if (search) {
    //   queryBuilder.where('item.name LIKE :search', { search: `%${search}%` });
    // }

    // // Ordenamiento (opcional)
    // if (sortBy && order) {
    //   queryBuilder.orderBy(`item.${sortBy}`, order.toUpperCase() as 'ASC' | 'DESC');
    // }
    query.orderBy('account.createdAt', 'DESC');
    query.skip(skip);
    query.take(limit);

    const [accounts, total] = await query.getManyAndCount();

    return {
      data: accounts,
      meta:{
        total,
        limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }
    };
  }

  findOne(id: string) {
    const account = this.accountRepository.findOne({
      where: { id },
      relations: ['customer','payments'],
    });
    if(!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }
    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto) {
    const account = await this.accountRepository.preload({
      id,
      ...updateAccountDto,
    });

    if(!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }
    return this.accountRepository.save(account);
  }

  async remove(id: string) {
    const account = await this.findOne(id);
    
    await Promise.all(
      account.payments.map(payment => this.paymentRepository.softDelete(payment.id))
    );

    await this.accountRepository.softDelete(id);
    return `Account deleted successfully`;
  }

  async getAccountsByCustomer(userId: string) {
    
    const query = this.accountRepository.createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone')
      .leftJoinAndSelect('zone.users', 'user');

    query.where('account.status = :status', { status: AccountStatus.ACTIVE });
    // query.andWhere('user.id = :userId', { userId });

    return query.getMany();
  }
}
