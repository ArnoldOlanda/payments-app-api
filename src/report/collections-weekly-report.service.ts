import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { Customer } from 'src/customer/entities/customer.entity';
import { Payment } from 'src/payment/entities/payment.entity';
import { Zone } from 'src/zone/entities/zone.entity';

import {
  format,
  parseCalendarDayToInstant,
  weekStart,
  weekEnd,
} from 'src/common/datetime/tempo';

import { CollectionsWeeklyQueryDto } from './dto/collections-weekly-query.dto';

export type WeeklyDayCell = {
  date: string;
  amount: number | null;
  paymentIds: string[];
  paymentCount: number;
};

export type WeeklyAccountRow = {
  accountId: string;
  accountDate: string | null;
  dueDate: string | null;
  amount: number;
  remainingBalance: number;
  creditType: string;
  customer: {
    id: string;
    name: string;
    lastName: string;
    zone: { id: string; name: string } | null;
  };
  days: WeeklyDayCell[];
  weeklyTotal: number;
};

export type WeeklyReportTotals = {
  totalCollected: number;
  paymentCount: number;
  byDay: Array<{ date: string; amount: number; paymentCount: number }>;
};

export type WeeklyReportResponse = {
  weekStart: string;
  weekEnd: string;
  anchorWeekday: number;
  days: Array<{ date: string; weekday: number }>;
  rows: WeeklyAccountRow[];
  totals: WeeklyReportTotals;
};

@Injectable()
export class CollectionsWeeklyReportService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async findOne(
    query: CollectionsWeeklyQueryDto,
    tz: string,
  ): Promise<WeeklyReportResponse> {
    if (!query.weekStart) {
      throw new BadRequestException('weekStart is required');
    }

    // Normalize to the Monday of the week containing the anchor (matches the
    // existing ficha de pagos: weekStart(d, 1, tz)).
    const anchor = this.anchorToDate(query.weekStart);
    const monday = weekStart(anchor, 1, tz);
    const sunday = weekEnd(anchor, 1, tz);

    // Build the 7 calendar days (YYYY-MM-DD) in `tz`, one parseCalendarDay per
    // day so we are immune to DST wrap inside the week.
    const calendarDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
      calendarDays.push(format(day, 'YYYY-MM-DD', tz));
    }

    const weekStartStr = calendarDays[0];
    const weekEndStr = calendarDays[6];

    const startInstant = parseCalendarDayToInstant(weekStartStr, tz, 'start');
    const endInstant = parseCalendarDayToInstant(weekEndStr, tz, 'end');

    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone')
      .where('account.status IN (:...activeStatuses)', {
        activeStatuses: [AccountStatus.ACTIVE, AccountStatus.OVERDUE],
      })
      .andWhere('zone.id = :zoneId', { zoneId: query.zoneId })
      .andWhere('account.deletedAt IS NULL')
      .orderBy('customer.lastName', 'ASC')
      .addOrderBy('customer.name', 'ASC')
      .addOrderBy('account.date', 'ASC')
      .getMany();

    const accountIds = accounts.map((a) => a.id);

    const paymentsQb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.account', 'account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('customer.zone', 'zone')
      .where('payment.date BETWEEN :from AND :to', {
        from: startInstant,
        to: endInstant,
      })
      .andWhere('payment.deletedAt IS NULL')
      .andWhere('account.deletedAt IS NULL')
      .andWhere('customer.deletedAt IS NULL')
      .andWhere('zone.id = :zoneId', { zoneId: query.zoneId })
      .orderBy('payment.date', 'ASC');

    if (query.userId) {
      paymentsQb.andWhere('payment.userId = :userId', {
        userId: query.userId,
      });
    }

    if (accountIds.length === 0) {
      // Still return the full shape with empty rows so the UI never has to
      // branch on "no accounts vs no payments".
      return this.emptyResponse(weekStartStr, weekEndStr, calendarDays);
    }

    paymentsQb.andWhere('payment.accountId IN (:...accountIds)', { accountIds });
    const payments = await paymentsQb.getMany();

    const paymentsByAccountAndDay = new Map<string, Map<string, typeof payments>>();
    for (const p of payments) {
      const dayStr = format(p.date, 'YYYY-MM-DD', tz);
      let inner = paymentsByAccountAndDay.get(p.accountId);
      if (!inner) {
        inner = new Map();
        paymentsByAccountAndDay.set(p.accountId, inner);
      }
      const list = inner.get(dayStr);
      if (list) {
        list.push(p);
      } else {
        inner.set(dayStr, [p]);
      }
    }

    const rows: WeeklyAccountRow[] = accounts.map((acc) => {
      const inner = paymentsByAccountAndDay.get(acc.id) ?? new Map();
      // `acc.customer` is typed CustomerInterface but the hydration via
      // leftJoinAndSelect yields the full Customer entity with zone hydrated.
      const customer = acc.customer as Customer | undefined;
      const zone = customer?.zone as Zone | null | undefined;
      const days: WeeklyDayCell[] = calendarDays.map((day) => {
        const list = inner.get(day) ?? [];
        if (list.length === 0) {
          return { date: day, amount: null, paymentIds: [], paymentCount: 0 };
        }
        const amount = list.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          date: day,
          amount,
          paymentIds: list.map((p) => p.id),
          paymentCount: list.length,
        };
      });
      const weeklyTotal = days.reduce(
        (sum, d) => sum + (d.amount ?? 0),
        0,
      );
      return {
        accountId: acc.id,
        accountDate: acc.date ? acc.date.toISOString() : null,
        dueDate: acc.dueDate ? acc.dueDate.toISOString() : null,
        amount: acc.amount,
        remainingBalance: acc.remainingBalance,
        creditType: acc.creditType,
        customer: customer
          ? {
              id: customer.id,
              name: customer.name,
              lastName: customer.lastName,
              zone: zone
                ? { id: zone.id, name: zone.name }
                : null,
            }
          : { id: '', name: '', lastName: '', zone: null },
        days,
        weeklyTotal,
      };
    });

    const byDay = calendarDays.map((day) => {
      let amount = 0;
      let paymentCount = 0;
      for (const r of rows) {
        const cell = r.days.find((d) => d.date === day);
        if (cell && cell.amount !== null) {
          amount += cell.amount;
          paymentCount += cell.paymentCount;
        }
      }
      return { date: day, amount, paymentCount };
    });

    const totalCollected = rows.reduce((sum, r) => sum + r.weeklyTotal, 0);
    const paymentCount = byDay.reduce((sum, d) => sum + d.paymentCount, 0);

    return {
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      anchorWeekday: 1,
      days: calendarDays.map((d, idx) => ({ date: d, weekday: idx })),
      rows,
      totals: { totalCollected, paymentCount, byDay },
    };
  }

  private anchorToDate(weekStartStr: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartStr);
    if (!match) {
      throw new BadRequestException(
        `weekStart must be YYYY-MM-DD (received: ${weekStartStr})`,
      );
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    // Noon in UTC is a safe anchor for weekStart (timezone wrapper applies tz).
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  private emptyResponse(
    weekStartStr: string,
    weekEndStr: string,
    calendarDays: string[],
  ): WeeklyReportResponse {
    return {
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      anchorWeekday: 1,
      days: calendarDays.map((d, idx) => ({ date: d, weekday: idx })),
      rows: [],
      totals: {
        totalCollected: 0,
        paymentCount: 0,
        byDay: calendarDays.map((d) => ({ date: d, amount: 0, paymentCount: 0 })),
      },
    };
  }
}
