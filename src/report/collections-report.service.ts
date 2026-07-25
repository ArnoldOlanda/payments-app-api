import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from 'src/payment/entities/payment.entity';

import { parseCalendarDayToInstant, format } from 'src/common/datetime/tempo';

import { CollectionsReportQueryDto } from './dto/collections-report-query.dto';

export const COLLECTIONS_REPORT_MAX_LIMIT = 200;

export type CollectionsReportRow = {
  id: string;
  date: string;
  registeredAt: string;
  amount: number;
  account: {
    id: string;
    amount: number;
    customer: {
      id: string;
      name: string;
      lastName: string;
      zone: { id: string; name: string } | null;
    };
  };
  user: { id: string; name: string } | null;
};

export type CollectionsReportResponse = {
  data: CollectionsReportRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    currentPage: number;
  };
};

@Injectable()
export class CollectionsReportService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async findAll(
    query: CollectionsReportQueryDto,
    tz: string,
  ): Promise<CollectionsReportResponse> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, COLLECTIONS_REPORT_MAX_LIMIT);

    const todayInTz = format(new Date(), 'YYYY-MM-DD', tz);

    const fromInstant = query.from
      ? this.tryParseCalendarDay(query.from, tz, 'start')
      : parseCalendarDayToInstant(todayInTz, tz, 'start');
    const toInstant = query.to
      ? this.tryParseCalendarDay(query.to, tz, 'end')
      : parseCalendarDayToInstant(todayInTz, tz, 'end');

    if (fromInstant.getTime() > toInstant.getTime()) {
      throw new BadRequestException(
        `from (${query.from}) must be on or before to (${query.to})`,
      );
    }

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.account', 'account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone')
      .leftJoinAndSelect('payment.user', 'user')
      .addSelect('payment.createdAt')
      .where('payment.date BETWEEN :from AND :to', {
        from: fromInstant,
        to: toInstant,
      })
      .andWhere('payment.deletedAt IS NULL')
      .orderBy('payment.date', 'DESC')
      .addOrderBy('payment.createdAt', 'DESC')
      .addOrderBy('payment.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.userId) {
      qb.andWhere('payment.userId = :userId', { userId: query.userId });
    }
    if (query.zoneId) {
      qb.andWhere('customer.zoneId = :zoneId', { zoneId: query.zoneId });
    }

    const [rows, total] = await qb.getManyAndCount();
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return {
      data: rows.map((row) => this.toRow(row as unknown as Parameters<CollectionsReportService['toRow']>[0])),
      meta: {
        total,
        page,
        limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  /**
   * Map the TypeORM-hydrated entity to the wire format the web consumes.
   * Keeps the response independent of the entity column set (e.g. entity
   * adds a new field, the wire stays stable).
   */
  private toRow(row: {
    id: string;
    date: Date;
    createdAt: Date;
    amount: number;
    account: {
      id: string;
      amount: number;
      customer: {
        id: string;
        name: string;
        lastName: string;
        zone: { id: string; name: string } | null;
      };
    };
    user: { id: string; name: string } | null;
  }): CollectionsReportRow {
    return {
      id: row.id,
      date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
      registeredAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      amount: row.amount,
      account: {
        id: row.account.id,
        amount: row.account.amount,
        customer: {
          id: row.account.customer.id,
          name: row.account.customer.name,
          lastName: row.account.customer.lastName,
          zone: row.account.customer.zone
            ? {
                id: row.account.customer.zone.id,
                name: row.account.customer.zone.name,
              }
            : null,
        },
      },
      user: row.user ? { id: row.user.id, name: row.user.name } : null,
    };
  }

  /**
   * `YYYY-MM-DD` in `tz` for "today". Reuses the project's TZ-aware
   * `format()` so DST transitions don't return yesterday near midnight.
   */
  private tryParseCalendarDay(
    value: string,
    tz: string,
    boundary: 'start' | 'end',
  ): Date {
    try {
      return parseCalendarDayToInstant(value, tz, boundary);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(detail);
    }
  }
}
