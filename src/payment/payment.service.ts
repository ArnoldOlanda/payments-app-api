import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { User } from 'src/user/entities/user.entity';
import { AccountService } from 'src/account/account.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly accountService: AccountService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const { accountId } = createPaymentDto;
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });
    const user = await this.userRepository.findOne({
      where: { id: createPaymentDto.userId },
    });

    if (!account) {
      throw new NotFoundException(`Cuenta con id ${accountId} no encontrada`);
    }

    if (!user) {
      throw new NotFoundException(
        `Usuario con id ${createPaymentDto.userId} no encontrado`,
      );
    }

    if (account.status === AccountStatus.FINISHED) {
      throw new NotFoundException(
        `La cuenta con id ${accountId} está finalizada`,
      );
    }

    const remainingBalance = account.remainingBalance;
    if (remainingBalance < createPaymentDto.amount) {
      throw new NotFoundException(
        `El monto ${createPaymentDto.amount} es mayor que el saldo restante ${remainingBalance}`,
      );
    }

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      account,
      user,
    });

    //Update remaining balance
    const restAmount = remainingBalance - createPaymentDto.amount;
    account.remainingBalance = restAmount;
    if (restAmount === 0) {
      account.status = AccountStatus.FINISHED;
    }

    const savedPayment = await this.paymentRepository.save(payment);
    await this.accountRepository.save(account);
    await this.accountService.invalidateCache();
    return savedPayment;
  }

  findAll(accountId: string | undefined) {
    if (accountId) {
      return this.paymentRepository.find({
        where: { account: { id: accountId } },
        relations: ['user'],
      });
    }
    return this.paymentRepository.find();
  }

  async findOne(id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['account'],
    });
    if (!payment) {
      throw new NotFoundException(`Pago con id ${id} no encontrado`);
    }
    return payment;
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    const payment = await this.paymentRepository.preload({
      id,
      ...updatePaymentDto,
    });

    if (!payment) {
      throw new NotFoundException(`Pago con id ${id} no encontrado`);
    }
    return this.paymentRepository.save(payment);
  }

  async remove(id: string) {
    const payment = await this.findOne(id);
    payment.account.remainingBalance += payment.amount;

    await this.accountRepository.save(payment.account);
    await this.paymentRepository.softDelete(id);
    return `Pago eliminado con éxito`;
  }
}
