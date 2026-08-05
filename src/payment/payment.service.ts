import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  IsNull,
  Not,
  Repository,
} from 'typeorm';

import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { AccountService } from 'src/account/account.service';
import { AnalyticsService } from 'src/analytics/analytics.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { Actor } from 'src/auth/types/actor.type';
import { loadUserZoneIds } from 'src/auth/helpers/zone-scope.helper';
import { dayEnd, dayStart } from 'src/common/datetime/tempo';

const PAYMENT_BUSINESS_TIMEZONE = 'America/Lima';

const isAdmin = (user: Actor): boolean => user.role === ValidRole.ADMIN;

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly accountService: AccountService,
    private readonly analyticsService: AnalyticsService,
    private readonly dataSource: DataSource,
  ) {}

  private async assertPaymentDayAvailable(
    manager: EntityManager,
    accountId: string,
    paymentDate: Date,
    excludedPaymentId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Payment> = {
      accountId,
      date: Between(
        dayStart(paymentDate, PAYMENT_BUSINESS_TIMEZONE),
        dayEnd(paymentDate, PAYMENT_BUSINESS_TIMEZONE),
      ),
      deletedAt: IsNull(),
    };

    if (excludedPaymentId) {
      where.id = Not(excludedPaymentId);
    }

    const paymentExists = await manager.exists(Payment, { where });
    if (paymentExists) {
      throw new ConflictException(
        'Ya existe un pago registrado para esta cuenta en la fecha seleccionada',
      );
    }
  }

  async create(createPaymentDto: CreatePaymentDto, actor: Actor) {
    const savedPayment = await this.dataSource.transaction(async (manager) => {
      const account = await manager
        .createQueryBuilder(Account, 'account')
        .leftJoinAndSelect('account.customer', 'customer')
        .leftJoinAndSelect('customer.zone', 'zone')
        .setLock('pessimistic_write', undefined, ['account'])
        .where('account.id = :id', { id: createPaymentDto.accountId })
        .getOne();

      if (!account) {
        throw new NotFoundException(
          `Cuenta con id ${createPaymentDto.accountId} no encontrada`,
        );
      }

      if (!isAdmin(actor)) {
        if (!account.customer) {
          throw new ForbiddenException(
            'Account has no customer; cannot validate access',
          );
        }
        if (!account.customer.zone) {
          throw new ForbiddenException(
            'Customer has no zone assigned; cannot validate access',
          );
        }
        const userZoneIds = await loadUserZoneIds(manager, actor.id);
        if (!userZoneIds.includes(account.customer.zone.id)) {
          throw new ForbiddenException(
            'Account customer is not within the user assigned zones',
          );
        }
      }

      await this.assertPaymentDayAvailable(
        manager,
        account.id,
        createPaymentDto.date,
      );

      if (account.status === AccountStatus.FINISHED) {
        throw new BadRequestException(
          `La cuenta con id ${createPaymentDto.accountId} está finalizada`,
        );
      }

      if (
        createPaymentDto.amount > account.remainingBalance &&
        createPaymentDto.closeWithOverpayment !== true
      ) {
        throw new BadRequestException(
          `Para registrar un pago mayor al saldo restante debe confirmarse el cierre del crédito`,
        );
      }

      const appliedAmount = Math.min(
        createPaymentDto.amount,
        account.remainingBalance,
      );

      const payment = manager.create(Payment, {
        accountId: createPaymentDto.accountId,
        account,
        date: createPaymentDto.date,
        amount: createPaymentDto.amount,
        appliedAmount,
        userId: actor.id,
        user: actor,
      });

      const restAmount = account.remainingBalance - appliedAmount;
      account.remainingBalance = restAmount;
      if (restAmount === 0) {
        account.status = AccountStatus.FINISHED;
      }

      const persisted = await manager.save(payment);
      await manager.save(account);
      return persisted;
    });

    // await this.accountService.invalidateCache();
    // await this.analyticsService.invalidateCache();
    return savedPayment;
  }

  async findAll(accountId: string, actor: Actor) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
      relations: ['customer', 'customer.zone'],
    });
    if (!account) {
      throw new NotFoundException(`Cuenta con id ${accountId} no encontrada`);
    }

    if (!isAdmin(actor)) {
      if (!account.customer || !account.customer.zone) {
        throw new ForbiddenException('Account customer has no zone assigned');
      }
      const userZoneIds = await this.dataSource.transaction((manager) =>
        loadUserZoneIds(manager, actor.id),
      );
      if (!userZoneIds.includes(account.customer.zone.id)) {
        throw new ForbiddenException(
          'Account customer is not within the user assigned zones',
        );
      }
    }

    return this.paymentRepository.find({
      where: { account: { id: accountId } },
      relations: ['user'],
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, actor: Actor) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['account', 'account.customer', 'account.customer.zone'],
    });
    if (!payment) {
      throw new NotFoundException(`Pago con id ${id} no encontrado`);
    }
    await this.assertPaymentAccess(payment, actor);
    return payment;
  }

  private async assertPaymentAccess(
    payment: {
      account?: {
        customer?: { zone?: { id: string } | null } | null;
      } | null;
    },
    actor: Actor,
  ): Promise<void> {
    if (isAdmin(actor)) return;
    const zone = payment.account?.customer?.zone;
    if (!zone) {
      throw new ForbiddenException(
        'Payment account customer has no zone assigned',
      );
    }
    const userZoneIds = await this.dataSource.transaction((manager) =>
      loadUserZoneIds(manager, actor.id),
    );
    if (!userZoneIds.includes(zone.id)) {
      throw new ForbiddenException(
        'Payment is not within the user assigned zones',
      );
    }
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    const updated = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException(`Pago con id ${id} no encontrado`);
      }

      if (
        updatePaymentDto.accountId !== undefined &&
        updatePaymentDto.accountId !== payment.accountId
      ) {
        throw new BadRequestException(
          'No se permite transferir un pago entre cuentas',
        );
      }

      const account = await manager.findOne(Account, {
        where: { id: payment.accountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new NotFoundException(`Cuenta no encontrada`);
      }

      if (updatePaymentDto.date !== undefined) {
        await this.assertPaymentDayAvailable(
          manager,
          account.id,
          updatePaymentDto.date,
          payment.id,
        );
      }

      const previousAppliedAmount = payment.appliedAmount ?? payment.amount;
      const newAmount = updatePaymentDto.amount ?? payment.amount;
      if (newAmount < 0) {
        throw new BadRequestException(`El monto no puede ser negativo`);
      }

      const availableBalance = account.remainingBalance + previousAppliedAmount;
      if (
        updatePaymentDto.amount !== undefined &&
        newAmount > availableBalance &&
        updatePaymentDto.closeWithOverpayment !== true
      ) {
        throw new BadRequestException(
          'Para registrar un pago mayor al saldo restante debe confirmarse el cierre del crédito',
        );
      }

      const newAppliedAmount = Math.min(newAmount, availableBalance);
      const newBalance = availableBalance - newAppliedAmount;
      account.remainingBalance = newBalance;
      if (account.status === AccountStatus.FINISHED && newBalance > 0) {
        account.status = AccountStatus.ACTIVE;
      }
      if (newBalance === 0) {
        account.status = AccountStatus.FINISHED;
      }

      payment.amount = newAmount;
      payment.appliedAmount = newAppliedAmount;
      if (updatePaymentDto.date !== undefined) {
        payment.date = updatePaymentDto.date;
      }

      await manager.save(account);
      return manager.save(payment);
    });

    // await this.accountService.invalidateCache();
    // await this.analyticsService.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    const message = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException(`Pago con id ${id} no encontrado`);
      }

      const account = await manager.findOne(Account, {
        where: { id: payment.accountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new NotFoundException(`Cuenta no encontrada`);
      }

      account.remainingBalance += payment.appliedAmount ?? payment.amount;
      if (
        account.status === AccountStatus.FINISHED &&
        account.remainingBalance > 0
      ) {
        account.status = AccountStatus.ACTIVE;
      }

      await manager.save(account);
      await manager.softDelete(Payment, id);
      return `Pago eliminado con éxito`;
    });

    // await this.accountService.invalidateCache();
    // await this.analyticsService.invalidateCache();
    return message;
  }
}
