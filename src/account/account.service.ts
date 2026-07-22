import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { AccountStatus } from './enums/account-status.enum';
import { PaginateAccountDto } from './dto/paginate-account.dto';
import { Payment } from 'src/payment/entities/payment.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { Actor } from 'src/auth/types/actor.type';
import { loadUserZoneIds } from 'src/auth/helpers/zone-scope.helper';

const isAdmin = (user: Actor): boolean => user.role === ValidRole.ADMIN;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private readonly cacheKeys = new Set<string>();

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly dataSource: DataSource,
  ) {}

  async create(createAccountDto: CreateAccountDto, actor: Actor) {
    const { customerId, amount } = createAccountDto;

    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
      relations: ['zone'],
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }
    if (!isAdmin(actor)) {
      if (!customer.zone) {
        throw new ForbiddenException(
          'Customer has no zone assigned; cannot validate access',
        );
      }
      const userZoneIds = await loadUserZoneIds(
        this.dataSource.manager,
        actor.id,
      );
      if (!userZoneIds.includes(customer.zone.id)) {
        throw new ForbiddenException(
          'Customer is not within the user assigned zones',
        );
      }
    }
    const account = this.accountRepository.create({
      ...createAccountDto,
      remainingBalance: amount,
      customer,
    });

    await this.invalidateCache();
    return this.accountRepository.save(account);
  }

  async findAll(paginationDto: PaginateAccountDto, actor: Actor) {
    const cacheKey = `accounts:${actor.id}:${JSON.stringify(paginationDto)}`;

    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      this.logger.log('Returning cached data');
      return cachedData;
    }

    const { zoneId, status, page, limit } = paginationDto;
    const skip = (page - 1) * limit;

    if (!isAdmin(actor)) {
      const userZoneIds = await loadUserZoneIds(
        this.dataSource.manager,
        actor.id,
      );
      if (userZoneIds.length === 0) {
        const empty = {
          data: [],
          meta: { total: 0, limit, totalPages: 0, currentPage: page },
        };
        await this.cacheManager.set(cacheKey, empty);
        this.cacheKeys.add(cacheKey);
        return empty;
      }
    }

    const query = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone');

    if (status) {
      query.where('account.status = :status', { status });
    }

    if (zoneId) {
      query.andWhere('zone.id = :zoneId', { zoneId });
    }

    if (!isAdmin(actor)) {
      const userZoneIds = await loadUserZoneIds(
        this.dataSource.manager,
        actor.id,
      );
      query.andWhere('zone.id IN (:...userZoneIds)', { userZoneIds });
    }

    query.orderBy('account.createdAt', 'DESC');
    query.skip(skip);
    query.take(limit);

    const [accounts, total] = await query.getManyAndCount();

    const results = {
      data: accounts,
      meta: {
        total,
        limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };

    await this.cacheManager.set(cacheKey, results);
    this.cacheKeys.add(cacheKey);

    return results;
  }

  async findOne(id: string, actor: Actor) {
    const account = await this.accountRepository.findOne({
      where: { id },
      relations: ['customer', 'customer.zone', 'payments'],
    });
    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }
    if (!isAdmin(actor)) {
      if (!account.customer?.zone) {
        throw new ForbiddenException(
          'Account customer has no zone assigned; cannot validate access',
        );
      }
      const userZoneIds = await loadUserZoneIds(
        this.dataSource.manager,
        actor.id,
      );
      if (!userZoneIds.includes(account.customer.zone.id)) {
        throw new ForbiddenException(
          'Account customer is not within the user assigned zones',
        );
      }
    }
    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto, actor: Actor) {
    const account = await this.dataSource.transaction(async (manager) => {
      const existing = await manager
        .createQueryBuilder(Account, 'account')
        .leftJoinAndSelect('account.customer', 'customer')
        .leftJoinAndSelect('customer.zone', 'zone')
        .leftJoinAndSelect('account.payments', 'payment')
        .setLock('pessimistic_write', undefined, ['account'])
        .where('account.id = :id', { id })
        .getOne();
      if (!existing) {
        throw new NotFoundException(`Account with id ${id} not found`);
      }
      if (!isAdmin(actor)) {
        if (!existing.customer?.zone) {
          throw new ForbiddenException(
            'Account customer has no zone assigned; cannot validate access',
          );
        }
        const userZoneIds = await loadUserZoneIds(manager, actor.id);
        if (!userZoneIds.includes(existing.customer.zone.id)) {
          throw new ForbiddenException(
            'Account customer is not within the user assigned zones',
          );
        }
      }

      const livePayments = (existing.payments ?? []).filter(
        (payment) =>
          payment.deletedAt === null || payment.deletedAt === undefined,
      );
      const sumOfPayments = livePayments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );

      if (updateAccountDto.amount !== undefined) {
        if (updateAccountDto.amount < sumOfPayments) {
          throw new BadRequestException(
            `El monto ${updateAccountDto.amount} es menor que la suma de pagos ya registrados (${sumOfPayments})`,
          );
        }
        existing.amount = updateAccountDto.amount;
        existing.remainingBalance = updateAccountDto.amount - sumOfPayments;
      }

      if (updateAccountDto.dueDate !== undefined) {
        if (existing.date && updateAccountDto.dueDate <= existing.date) {
          throw new BadRequestException(
            'La fecha de vencimiento no puede ser anterior o igual a la fecha del credito',
          );
        }
        existing.dueDate = updateAccountDto.dueDate;
      }

      if (
        existing.remainingBalance === 0 &&
        existing.status !== AccountStatus.FINISHED
      ) {
        existing.status = AccountStatus.FINISHED;
      } else if (
        existing.status === AccountStatus.FINISHED &&
        existing.remainingBalance > 0
      ) {
        existing.status = AccountStatus.ACTIVE;
      }

      return manager.save(existing);
    });

    await this.invalidateCache();
    return account;
  }

  async remove(id: string) {
    const account = await this.findOne(id, { role: ValidRole.ADMIN } as Actor);

    await Promise.all(
      account.payments.map((payment) =>
        this.paymentRepository.softDelete(payment.id),
      ),
    );

    await this.accountRepository.softDelete(id);
    await this.invalidateCache();
    return `Account deleted successfully`;
  }

  async getAccountsByCustomer(userId: string) {
    const cacheKey = 'accountsByCustomer';
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      this.logger.log('Returning cached data');
      return cachedData;
    }

    const query = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone')
      .leftJoinAndSelect('zone.users', 'user');

    query.where('account.status = :status', { status: AccountStatus.ACTIVE });
    query.andWhere('user.id = :userId', { userId });

    const results = await query.getMany();
    await this.cacheManager.set(cacheKey, results);
    this.cacheKeys.add(cacheKey);
    return results;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    try {
      const result = await this.accountRepository
        .createQueryBuilder()
        .update(Account)
        .set({ status: AccountStatus.FINISHED })
        .where('status = :active', { active: AccountStatus.ACTIVE })
        .andWhere('dueDate IS NOT NULL')
        .andWhere(
          "dueDate AT TIME ZONE 'America/Lima' <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date",
        )
        .execute();

      const updated = result.affected ?? 0;
      this.logger.log(`${updated} accounts status updated`);
      if (updated > 0) {
        await this.invalidateCache();
      }
    } catch (error) {
      this.logger.error(
        'handleCron failed to mark overdue accounts as FINISHED',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async invalidateCache() {
    const keys = Array.from(this.cacheKeys);
    this.cacheKeys.clear();
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }
}
