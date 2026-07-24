import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { Payment } from 'src/payment/entities/payment.entity';
import { Customer } from 'src/customer/entities/customer.entity';

import { Actor } from 'src/auth/types/actor.type';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { loadUserZoneIds } from 'src/auth/helpers/zone-scope.helper';

import { addDay, format } from '@formkit/tempo';
import { dayStart, dayEnd } from 'src/common/datetime/tempo';

import { CollectionsRangeDto } from './dto/collections-range.dto';

const isAdmin = (user: Actor): boolean => user.role === ValidRole.ADMIN;

export type KpiResponse = {
  customers: number;
  activeAccounts: number;
  pendingBalance: number;
  collectedToday: number;
};

export type CollectionBucket = {
  date: string;
  amount: number;
};

export type CollectionsResponse = {
  buckets: CollectionBucket[];
};

export type ZoneDistributionItem = {
  zoneId: string;
  name: string;
  count: number;
  balance: number;
};

export type ZoneDistributionResponse = {
  items: ZoneDistributionItem[];
};

type ResolvedScope = {
  zoneIds: string[] | null;
};

const isoDay = (d: Date): string => format(d, 'YYYY-MM-DD', 'en');

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) {}

  async getKpis(
    zoneId: string | undefined,
    actor: Actor,
    tz: string,
  ): Promise<KpiResponse> {
    const scope = await this.resolveScope(actor, zoneId);

    const customerQb = this.customerRepository.createQueryBuilder('customer');
    this.applyZoneScope(customerQb, 'customer', scope);
    const customers = await customerQb.getCount();

    const activeAccountQb = this.accountRepository
      .createQueryBuilder('account')
      .leftJoin('account.customer', 'customer')
      .where('account.status IN (:...activeStatuses)', {
        activeStatuses: [AccountStatus.ACTIVE, AccountStatus.OVERDUE],
      });
    this.applyZoneScope(activeAccountQb, 'customer', scope);
    const activeAccounts = await activeAccountQb.getCount();

    const pendingQb = this.accountRepository
      .createQueryBuilder('account')
      .leftJoin('account.customer', 'customer')
      .select('COALESCE(SUM(account.remainingBalance), 0)', 'sum')
      .where('account.status IN (:...activeStatuses)', {
        activeStatuses: [AccountStatus.ACTIVE, AccountStatus.OVERDUE],
      });
    this.applyZoneScope(pendingQb, 'customer', scope);
    const pendingRow = await pendingQb.getRawOne<{ sum: string }>();
    const pendingBalance = Number(pendingRow?.sum ?? 0);

    const todayStart = dayStart(new Date(), tz);
    const todayEnd = dayEnd(new Date(), tz);
    const paymentQb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.account', 'account')
      .leftJoin('account.customer', 'customer')
      .select('COALESCE(SUM(payment.amount), 0)', 'sum')
      .where('payment.date BETWEEN :from AND :to', {
        from: todayStart,
        to: todayEnd,
      });
    this.applyZoneScope(paymentQb, 'customer', scope);
    const paymentRow = await paymentQb.getRawOne<{ sum: string }>();
    const collectedToday = Number(paymentRow?.sum ?? 0);

    return {
      customers,
      activeAccounts,
      pendingBalance,
      collectedToday,
    };
  }

  async getCollections(
    query: CollectionsRangeDto,
    actor: Actor,
    tz: string,
  ): Promise<CollectionsResponse> {
    const { zoneId, from, to } = query;
    const scope = await this.resolveScope(actor, zoneId);

    const today = new Date();
    const endDate = to ?? today;
    const startDate = from ?? addDay(endDate, -13);

    const startDay = dayStart(startDate, tz);
    const endDay = dayEnd(endDate, tz);

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.account', 'account')
      .leftJoin('account.customer', 'customer')
      .select("to_char(date_trunc('day', payment.date), 'YYYY-MM-DD')", 'day')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
      .where('payment.date BETWEEN :from AND :to', {
        from: startDay,
        to: endDay,
      })
      .groupBy('day')
      .orderBy('day', 'ASC');

    this.applyZoneScope(qb, 'customer', scope);

    const rows = await qb.getRawMany<{ day: string; amount: string }>();
    const byDay = new Map<string, number>();
    rows.forEach((r) => byDay.set(r.day, Number(r.amount)));

    const buckets: CollectionBucket[] = [];
    let cursor = new Date(startDay);
    while (cursor.getTime() <= endDay.getTime()) {
      const key = isoDay(cursor);
      buckets.push({ date: key, amount: byDay.get(key) ?? 0 });
      cursor = addDay(cursor, 1);
    }

    return { buckets };
  }

  async getZoneDistribution(
    zoneId: string | undefined,
    actor: Actor,
  ): Promise<ZoneDistributionResponse> {
    const scope = await this.resolveScope(actor, zoneId);

    const qb = this.accountRepository
      .createQueryBuilder('account')
      .leftJoin('account.customer', 'customer')
      .leftJoin('customer.zone', 'zone')
      .select('zone.id', 'zoneId')
      .addSelect('zone.name', 'name')
      .addSelect('COUNT(account.id)', 'count')
      .addSelect('COALESCE(SUM(account.remainingBalance), 0)', 'balance')
      .where('account.status IN (:...activeStatuses)', {
        activeStatuses: [AccountStatus.ACTIVE, AccountStatus.OVERDUE],
      })
      .andWhere('zone.id IS NOT NULL')
      .groupBy('zone.id')
      .addGroupBy('zone.name')
      .orderBy('count', 'DESC')
      .limit(8);

    this.applyZoneScope(qb, 'customer', scope);

    const rows = await qb.getRawMany<{
      zoneId: string;
      name: string;
      count: string;
      balance: string;
    }>();

    return {
      items: rows.map((r) => ({
        zoneId: r.zoneId,
        name: r.name,
        count: Number(r.count),
        balance: Number(r.balance),
      })),
    };
  }

  async getUpcomingDue(
    zoneId: string | undefined,
    limit: number,
    actor: Actor,
  ) {
    const scope = await this.resolveScope(actor, zoneId);

    const qb = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone')
      .where('account.status = :status', { status: AccountStatus.ACTIVE })
      .andWhere('account.dueDate IS NOT NULL')
      .andWhere('account.remainingBalance > 0')
      .orderBy('account.dueDate', 'ASC')
      .take(limit);

    this.applyZoneScope(qb, 'customer', scope);

    return qb.getMany();
  }

  async getRecentPayments(
    zoneId: string | undefined,
    limit: number,
    from: Date | undefined,
    to: Date | undefined,
    actor: Actor,
  ) {
    const scope = await this.resolveScope(actor, zoneId);

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.account', 'account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone')
      .leftJoinAndSelect('payment.user', 'user')
      .addSelect('payment.createdAt')
      .orderBy('payment.date', 'DESC')
      .take(limit);

    if (from && to) {
      qb.where('payment.date BETWEEN :from AND :to', { from, to });
    }

    this.applyZoneScope(qb, 'customer', scope);

    return qb.getMany();
  }

  private async resolveScope(
    actor: Actor,
    zoneId?: string,
  ): Promise<ResolvedScope> {
    if (!zoneId) {
      return {
        zoneIds: isAdmin(actor)
          ? null
          : await loadUserZoneIds(this.dataSource.manager, actor.id),
      };
    }

    if (!isAdmin(actor)) {
      const userZoneIds = await loadUserZoneIds(
        this.dataSource.manager,
        actor.id,
      );
      if (!userZoneIds.includes(zoneId)) {
        throw new ForbiddenException(
          'La zona solicitada no esta asignada al usuario',
        );
      }
    }
    return { zoneIds: [zoneId] };
  }

  private applyZoneScope(
    qb: {
      andWhere: (sql: string, params?: Record<string, unknown>) => unknown;
    },
    alias: string,
    scope: ResolvedScope,
  ): void {
    if (scope.zoneIds === null) return;

    qb.andWhere(`${alias}.zoneId IN (:...zoneIds)`, {
      zoneIds: scope.zoneIds,
    });
  }
}
