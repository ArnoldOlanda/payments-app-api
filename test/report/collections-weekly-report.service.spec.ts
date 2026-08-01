import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { Payment } from 'src/payment/entities/payment.entity';

import { CollectionsWeeklyReportService } from 'src/report/collections-weekly-report.service';

const ZONE_ID = '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3b';
const USER_ID = '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3a';

function buildQb() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
  };
  return qb;
}

function buildAccountQb(accounts: any[] = []) {
  const qb = buildQb();
  qb.getMany = jest.fn().mockResolvedValue(accounts);
  return qb;
}

function buildPaymentQb(payments: any[] = []) {
  const qb = buildQb();
  qb.getMany = jest.fn().mockResolvedValue(payments);
  return qb;
}

function buildAccount({
  id = 'acc-1',
  status = AccountStatus.ACTIVE,
  amount = 1000,
  remainingBalance = 500,
  creditType = 'DIARIO',
  customer = {
    id: 'c-1',
    name: 'Ada',
    lastName: 'Lovelace',
    zone: { id: 'z-1', name: 'Zone A' },
  },
  date = new Date('2026-07-06T12:00:00.000Z'),
  dueDate = new Date('2026-07-12T12:00:00.000Z'),
} = {}) {
  return {
    id,
    status,
    amount,
    remainingBalance,
    creditType,
    customer,
    date,
    dueDate,
  };
}

function buildPayment({
  id = 'pay-1',
  accountId = 'acc-1',
  amount = 50,
  date = new Date('2026-07-06T15:00:00.000Z'),
} = {}) {
  return { id, accountId, amount, date };
}

async function buildService({
  accounts = [],
  payments = [],
}: { accounts?: any[]; payments?: any[] } = {}) {
  const accountQb = buildAccountQb(accounts);
  const paymentQb = buildPaymentQb(payments);

  const accountRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(accountQb),
  };
  const paymentRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(paymentQb),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CollectionsWeeklyReportService,
      { provide: getRepositoryToken(Account), useValue: accountRepo },
      { provide: getRepositoryToken(Payment), useValue: paymentRepo },
    ],
  }).compile();

  return {
    service: module.get(CollectionsWeeklyReportService),
    accountQb,
    paymentQb,
  };
}

function findCall(
  calls: unknown[][],
  predicate: (sql: string) => boolean,
): unknown[] | undefined {
  return calls.find(
    (c) => typeof c[0] === 'string' && predicate(c[0] as string),
  );
}

describe('CollectionsWeeklyReportService', () => {
  describe('anchor normalization', () => {
    it('normalizes a mid-week anchor to Monday–Sunday in America/Argentina/Buenos_Aires', async () => {
      const { service } = await buildService();

      const result = await service.findOne(
        { weekStart: '2026-07-08', zoneId: ZONE_ID },
        'America/Argentina/Buenos_Aires',
      );

      expect(result.weekStart).toBe('2026-07-06');
      expect(result.weekEnd).toBe('2026-07-12');
      expect(result.anchorWeekday).toBe(1);
      expect(result.days).toHaveLength(7);
      expect(result.days.map((d) => d.date)).toEqual([
        '2026-07-06',
        '2026-07-07',
        '2026-07-08',
        '2026-07-09',
        '2026-07-10',
        '2026-07-11',
        '2026-07-12',
      ]);
      expect(result.days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('normalizes the same calendar-day anchor to Monday–Sunday in UTC', async () => {
      const { service } = await buildService();

      const result = await service.findOne(
        { weekStart: '2026-07-08', zoneId: ZONE_ID },
        'UTC',
      );

      expect(result.weekStart).toBe('2026-07-06');
      expect(result.weekEnd).toBe('2026-07-12');
      expect(result.days.map((d) => d.date)).toEqual([
        '2026-07-06',
        '2026-07-07',
        '2026-07-08',
        '2026-07-09',
        '2026-07-10',
        '2026-07-11',
        '2026-07-12',
      ]);
    });

    it('keeps a Monday anchor unchanged', async () => {
      const { service } = await buildService();

      const result = await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      expect(result.weekStart).toBe('2026-07-06');
      expect(result.weekEnd).toBe('2026-07-12');
    });

    it('rejects malformed anchor strings with BadRequestException', async () => {
      const { service } = await buildService();

      await expect(
        service.findOne({ weekStart: '07/08/2026', zoneId: ZONE_ID }, 'UTC'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('account rows', () => {
    it('renders every active and overdue account as a row with seven aligned cells', async () => {
      const accounts = [
        buildAccount({ id: 'acc-1', status: AccountStatus.ACTIVE }),
        buildAccount({
          id: 'acc-2',
          status: AccountStatus.OVERDUE,
          amount: 800,
          remainingBalance: 800,
          creditType: 'SEMANAL',
          customer: {
            id: 'c-2',
            name: 'Grace',
            lastName: 'Hopper',
            zone: { id: 'z-1', name: 'Zone A' },
          },
        }),
      ];
      const { service } = await buildService({ accounts });

      const result = await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      expect(result.rows).toHaveLength(2);
      for (const row of result.rows) {
        expect(row.days).toHaveLength(7);
        for (let i = 0; i < 7; i++) {
          expect(row.days[i].date).toBe(result.days[i].date);
        }
      }
    });

    it('leaves no-payment cells as null amount, empty paymentIds, and zero paymentCount', async () => {
      const accounts = [buildAccount({ id: 'acc-1' })];
      const payments = [
        buildPayment({
          id: 'pay-1',
          accountId: 'acc-1',
          amount: 100,
          date: new Date('2026-07-06T12:00:00.000Z'),
        }),
      ];
      const { service } = await buildService({ accounts, payments });

      const result = await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      const row = result.rows[0];
      expect(row.days[0].amount).toBe(100);
      expect(row.days[0].paymentCount).toBe(1);
      expect(row.days[0].paymentIds).toEqual(['pay-1']);

      for (let i = 1; i < 7; i++) {
        expect(row.days[i].amount).toBeNull();
        expect(row.days[i].paymentCount).toBe(0);
        expect(row.days[i].paymentIds).toEqual([]);
      }
    });

    it('issues customer.lastName ASC, customer.name ASC, account.date ASC as the account row ordering', async () => {
      const accounts = [
        buildAccount({ id: 'acc-a' }),
        buildAccount({
          id: 'acc-b',
          customer: {
            id: 'c-2',
            name: 'Grace',
            lastName: 'Hopper',
            zone: { id: 'z-1', name: 'Zone A' },
          },
        }),
      ];
      const { service, accountQb } = await buildService({ accounts });

      await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      expect(accountQb.orderBy).toHaveBeenCalledWith(
        'customer.lastName',
        'ASC',
      );
      expect(accountQb.addOrderBy).toHaveBeenCalledWith('customer.name', 'ASC');
      expect(accountQb.addOrderBy).toHaveBeenCalledWith('account.date', 'ASC');
    });
  });

  describe('payment aggregation', () => {
    it('aggregates multiple payments in the same account+day cell', async () => {
      const accounts = [buildAccount({ id: 'acc-1' })];
      const payments = [
        buildPayment({
          id: 'pay-1',
          accountId: 'acc-1',
          amount: 25,
          date: new Date('2026-07-06T09:00:00.000Z'),
        }),
        buildPayment({
          id: 'pay-2',
          accountId: 'acc-1',
          amount: 75,
          date: new Date('2026-07-06T18:00:00.000Z'),
        }),
      ];
      const { service } = await buildService({ accounts, payments });

      const result = await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      const cell = result.rows[0].days[0];
      expect(cell.amount).toBe(100);
      expect(cell.paymentCount).toBe(2);
      expect(cell.paymentIds).toEqual(['pay-1', 'pay-2']);
    });

    it('row weeklyTotal, totals.byDay, and totals.totalCollected/paymentCount all agree', async () => {
      const accounts = [
        buildAccount({ id: 'acc-1' }),
        buildAccount({
          id: 'acc-2',
          amount: 800,
          remainingBalance: 800,
          customer: {
            id: 'c-2',
            name: 'Grace',
            lastName: 'Hopper',
            zone: { id: 'z-1', name: 'Zone A' },
          },
        }),
      ];
      const payments = [
        buildPayment({
          id: 'pay-1',
          accountId: 'acc-1',
          amount: 100,
          date: new Date('2026-07-06T12:00:00.000Z'),
        }),
        buildPayment({
          id: 'pay-2',
          accountId: 'acc-1',
          amount: 50,
          date: new Date('2026-07-08T12:00:00.000Z'),
        }),
        buildPayment({
          id: 'pay-3',
          accountId: 'acc-2',
          amount: 200,
          date: new Date('2026-07-08T13:00:00.000Z'),
        }),
      ];
      const { service } = await buildService({ accounts, payments });

      const result = await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      expect(result.totals.byDay[0]).toEqual({
        date: '2026-07-06',
        amount: 100,
        paymentCount: 1,
      });
      expect(result.totals.byDay[2]).toEqual({
        date: '2026-07-08',
        amount: 250,
        paymentCount: 2,
      });
      expect(result.totals.totalCollected).toBe(350);
      expect(result.totals.paymentCount).toBe(3);

      const sumOfRowTotals = result.rows.reduce((s, r) => s + r.weeklyTotal, 0);
      expect(sumOfRowTotals).toBe(result.totals.totalCollected);
    });
  });

  describe('userId filter', () => {
    it('forwards userId to the payments query and does not change the account scope', async () => {
      const accounts = [
        buildAccount({ id: 'acc-1' }),
        buildAccount({
          id: 'acc-2',
          customer: {
            id: 'c-2',
            name: 'Grace',
            lastName: 'Hopper',
            zone: { id: 'z-1', name: 'Zone A' },
          },
        }),
      ];
      const { service, accountQb, paymentQb } = await buildService({
        accounts,
      });

      await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID, userId: USER_ID },
        'UTC',
      );

      const paymentUserIdCall = findCall(paymentQb.andWhere.mock.calls, (sql) =>
        sql.includes('payment.userId'),
      );
      expect(paymentUserIdCall).toBeDefined();
      expect(paymentUserIdCall![1]).toEqual({ userId: USER_ID });

      const accountUserIdCall = findCall(accountQb.andWhere.mock.calls, (sql) =>
        sql.includes('userId'),
      );
      expect(accountUserIdCall).toBeUndefined();
    });

    it('omits the userId filter when userId is not provided', async () => {
      const { service, paymentQb } = await buildService({
        accounts: [buildAccount()],
      });

      await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      const paymentUserIdCall = findCall(paymentQb.andWhere.mock.calls, (sql) =>
        sql.includes('payment.userId'),
      );
      expect(paymentUserIdCall).toBeUndefined();
    });
  });

  describe('empty account scope', () => {
    it('returns the seven-day shape with zero totals when no active/overdue accounts match', async () => {
      const { service } = await buildService({ accounts: [], payments: [] });

      const result = await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      expect(result.weekStart).toBe('2026-07-06');
      expect(result.weekEnd).toBe('2026-07-12');
      expect(result.days).toHaveLength(7);
      expect(result.rows).toEqual([]);
      expect(result.totals.totalCollected).toBe(0);
      expect(result.totals.paymentCount).toBe(0);
      expect(result.totals.byDay).toHaveLength(7);
      for (const d of result.totals.byDay) {
        expect(d.amount).toBe(0);
        expect(d.paymentCount).toBe(0);
      }
    });
  });

  describe('exclusion of deleted and non-matching records', () => {
    it('filters accounts by status IN (ACTIVE, OVERDUE) and excludes deleted accounts', async () => {
      const { service, accountQb } = await buildService({
        accounts: [buildAccount()],
      });

      await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      const statusCall = findCall(accountQb.where.mock.calls, (sql) =>
        sql.includes('account.status IN'),
      );
      expect(statusCall).toBeDefined();
      expect(statusCall![1]).toEqual({
        activeStatuses: [AccountStatus.ACTIVE, AccountStatus.OVERDUE],
      });

      const zoneCall = findCall(accountQb.andWhere.mock.calls, (sql) =>
        sql.includes('zone.id'),
      );
      expect(zoneCall).toBeDefined();
      expect(zoneCall![1]).toEqual({ zoneId: ZONE_ID });

      const deletedCall = findCall(accountQb.andWhere.mock.calls, (sql) =>
        sql.includes('account.deletedAt IS NULL'),
      );
      expect(deletedCall).toBeDefined();
    });

    it('filters payments by deletedAt IS NULL on payment, account, and customer', async () => {
      const { service, paymentQb } = await buildService({
        accounts: [buildAccount()],
        payments: [buildPayment()],
      });

      await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      expect(
        findCall(paymentQb.andWhere.mock.calls, (sql) =>
          sql.includes('payment.deletedAt IS NULL'),
        ),
      ).toBeDefined();
      expect(
        findCall(paymentQb.andWhere.mock.calls, (sql) =>
          sql.includes('account.deletedAt IS NULL'),
        ),
      ).toBeDefined();
      expect(
        findCall(paymentQb.andWhere.mock.calls, (sql) =>
          sql.includes('customer.deletedAt IS NULL'),
        ),
      ).toBeDefined();
    });

    it('scopes the payments query to the listed active/overdue accountIds', async () => {
      const accounts = [
        buildAccount({ id: 'acc-1' }),
        buildAccount({
          id: 'acc-2',
          customer: {
            id: 'c-2',
            name: 'Grace',
            lastName: 'Hopper',
            zone: { id: 'z-1', name: 'Zone A' },
          },
        }),
      ];
      const { service, paymentQb } = await buildService({
        accounts,
        payments: [buildPayment({ accountId: 'acc-1' })],
      });

      await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'UTC',
      );

      const accountIdsCall = findCall(paymentQb.andWhere.mock.calls, (sql) =>
        sql.includes('payment.accountId IN'),
      );
      expect(accountIdsCall).toBeDefined();
      expect(
        (accountIdsCall![1] as { accountIds: string[] }).accountIds,
      ).toEqual(['acc-1', 'acc-2']);
    });

    it('resolves the payment date range as calendar-day start..end in the actor timezone', async () => {
      const { service, paymentQb } = await buildService({
        accounts: [buildAccount()],
        payments: [buildPayment()],
      });

      await service.findOne(
        { weekStart: '2026-07-06', zoneId: ZONE_ID },
        'America/Argentina/Buenos_Aires',
      );

      const whereCall = findCall(paymentQb.where.mock.calls, (sql) =>
        sql.includes('payment.date BETWEEN'),
      );
      expect(whereCall).toBeDefined();
      const params = whereCall![1] as { from: Date; to: Date };
      expect(params.from.toISOString()).toBe('2026-07-06T03:00:00.000Z');
      expect(params.to.toISOString()).toBe('2026-07-13T02:59:59.999Z');
    });
  });
});
