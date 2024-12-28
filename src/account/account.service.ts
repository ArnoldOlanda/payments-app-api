import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';

@Injectable()
export class AccountService {
  
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async create(createAccountDto: CreateAccountDto) {
    const { customerId } = createAccountDto;

    const customer = await this.accountRepository.findOne({where: {id: customerId}});
    if(!customer) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }
    const account = this.accountRepository.create({
      ...createAccountDto,
      customer,
    });

    return this.accountRepository.save(account);
  }

  findAll() {
    return this.accountRepository.find({relations: ['customer']});
  }

  findOne(id: string) {
    const account = this.accountRepository.findOne({where: { id }});
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
    await this.findOne(id);
    await this.accountRepository.softDelete(id);
    return `Account deleted successfully`;
  }
}
