import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class PaymentService {

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {

    const { accountId } = createPaymentDto
    const account = await this.accountRepository.findOne({where: {id: accountId}});
    const user = await this.userRepository.findOne({where: {id: createPaymentDto.userId}});

    if(!account) {
      throw new NotFoundException(`Account with id ${accountId} not found`);
    }

    if(!user) {
      throw new NotFoundException(`User with id ${createPaymentDto.userId} not found`);
    }

    if(account.status === AccountStatus.FINISHED) {
      throw new NotFoundException(`Account with id ${accountId} is finished`);
    }

    const remainingBalance = account.remainingBalance;
    if(remainingBalance < createPaymentDto.amount) {
      throw new NotFoundException(
        `The amount ${createPaymentDto.amount} is greater than the remaining balance ${remainingBalance}`
      );
    }

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      account,
      user
    });

    //Update remaining balance
    const restAmount = remainingBalance - createPaymentDto.amount;
    account.remainingBalance = restAmount;
    if(restAmount === 0){
      account.status = AccountStatus.FINISHED;
    }

    const savedPayment = await this.paymentRepository.save(payment);
    await this.accountRepository.save(account);
    return savedPayment;
  }

  findAll(accountId: string|undefined) {
    if(accountId) {
      return this.paymentRepository.find({
        where: {account: {id: accountId}},
        relations: ['user']
      });
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
