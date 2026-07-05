import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { AccountStatus } from './enums/account-status.enum';
import { PaginateAccountDto } from './dto/paginate-account.dto';
import { Payment } from 'src/payment/entities/payment.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

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
  ) {}

  async create(createAccountDto: CreateAccountDto) {
    const { customerId, amount } = createAccountDto;

    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }
    const account = this.accountRepository.create({
      ...createAccountDto,
      remainingBalance: amount,
      customer,
    });

    await this.invalidateCache();
    return this.accountRepository.save(account);
  }

  async findAll(paginationDto: PaginateAccountDto) {
    const cacheKey = `accounts:${JSON.stringify(paginationDto)}`;

    // Verificar si tenemos estos resultados en caché
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      this.logger.log('Returning cached data');
      return cachedData;
    }

    const { zoneId, status, page, limit, search, order, sortBy } =
      paginationDto;
    const skip = (page - 1) * limit;
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

  async findOne(id: string) {
    const account = await this.accountRepository.findOne({
      where: { id },
      relations: ['customer', 'payments'],
    });
    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }
    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto) {
    const account = await this.accountRepository.preload({
      id,
      ...updateAccountDto,
    });

    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }

    await this.invalidateCache();
    return this.accountRepository.save(account);
  }

  async remove(id: string) {
    const account = await this.findOne(id);

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
        .andWhere('dueDate <= CURRENT_DATE')
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
