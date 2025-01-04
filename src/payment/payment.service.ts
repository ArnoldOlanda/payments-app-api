import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Account } from 'src/account/entities/account.entity';

@Injectable()
export class PaymentService {

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {

    const { accountId } = createPaymentDto
    const account = await this.accountRepository.findOne({where: {id: accountId}});
    if(!account) {
      throw new NotFoundException(`Account with id ${accountId} not found`);
    }

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      account,
    });

    return this.paymentRepository.save(payment);
  }

  findAll(accountId: string|undefined) {
    if(accountId) {
      return this.paymentRepository.find({where: {account: {id: accountId}}});
    }
    return this.paymentRepository.find();
  }

  async findOne(id: string) {
    const payment = await this.paymentRepository.findOne({where: {id}});
    if(!payment) {
      throw new NotFoundException(`Payment with id ${id} not found`);
    }
    return payment;
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    const payment = await this.paymentRepository.preload({
      id,
      ...updatePaymentDto,
    });

    if(!payment) {
      throw new NotFoundException(`Payment with id ${id} not found`);
    }
    return this.paymentRepository.save(payment);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.paymentRepository.softDelete(id);
    return `Payment deleted successfully`;
  }
}
