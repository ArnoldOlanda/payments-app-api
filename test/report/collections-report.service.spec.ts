import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Payment } from 'src/payment/entities/payment.entity';

import { CollectionsReportService } from 'src/report/collections-report.service';

function buildQb() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[buildHydratedRow()], 1]),
  };
  return qb;
}

function buildHydratedRow() {
  return {
    id: 'payment-1',
    date: new Date('2026-07-25T03:00:00.000Z'),
    createdAt: new Date('2026-07-25T03:05:00.000Z'),
    amount: 50,
    account: {
      id: 'a-1',
      amount: 1000,
      customer: {
        id: 'c-1',
        name: 'Ada',
        lastName: 'Lovelace',
        zone: { id: 'z-1', name: 'Zone A' },
      },
    },
    user: { id: 'u-1', name: 'Cobrador Uno' },
  };
}

async function buildService() {
  const paymentQb = buildQb();
  const paymentRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(paymentQb),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CollectionsReportService,
      { provide: getRepositoryToken(Payment), useValue: paymentRepo },
      { provide: DataSource, useValue: { manager: {} } },
    ],
  }).compile();

  return { service: module.get(CollectionsReportService), qb: paymentQb };
}

const fixedNow = new Date('2026-07-25T12:00:00Z');

describe('CollectionsReportService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('defaults the date range to today in the actor timezone when from/to are omitted', async () => {
    const { service, qb } = await buildService();

    await service.findAll(
      { page: 1, limit: 10 },
      'America/Argentina/Buenos_Aires',
    );

    const whereCall = qb.where.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('payment.date BETWEEN'),
    );
    expect(whereCall).toBeDefined();
    const params = whereCall![1] as { from: Date; to: Date };
    // 2026-07-25T00:00 ART == 2026-07-25T03:00Z
    expect(params.from.toISOString()).toBe('2026-07-25T03:00:00.000Z');
    // 2026-07-25T23:59:59.999 ART == 2026-07-26T02:59:59.999Z
    expect(params.to.toISOString()).toBe('2026-07-26T02:59:59.999Z');
  });

  it('honors from/to and resolves them as calendar days in the actor timezone', async () => {
    const { service, qb } = await buildService();

    await service.findAll(
      { from: '2026-07-01', to: '2026-07-31', page: 1, limit: 10 },
      'Asia/Tokyo',
    );

    const whereCall = qb.where.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('payment.date BETWEEN'),
    );
    const params = whereCall![1] as { from: Date; to: Date };
    // 2026-07-01T00:00 JST == 2026-06-30T15:00Z
    expect(params.from.toISOString()).toBe('2026-06-30T15:00:00.000Z');
    // 2026-07-31T23:59:59.999 JST == 2026-07-31T14:59:59.999Z
    expect(params.to.toISOString()).toBe('2026-07-31T14:59:59.999Z');
  });

  it('rejects inverted range with BadRequestException', async () => {
    const { service } = await buildService();
    await expect(
      service.findAll(
        { from: '2026-07-31', to: '2026-07-01', page: 1, limit: 10 },
        'UTC',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects malformed calendar-day strings', async () => {
    const { service } = await buildService();
    await expect(
      service.findAll({ from: '07/01/2026', page: 1, limit: 10 }, 'UTC'),
    ).rejects.toThrow(BadRequestException);
  });

  it('adds payment.userId filter when userId is provided', async () => {
    const { service, qb } = await buildService();

    await service.findAll(
      { userId: '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3a', page: 1, limit: 10 },
      'UTC',
    );

    const userIdCall = qb.andWhere.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('payment.userId'),
    );
    expect(userIdCall).toBeDefined();
    expect(userIdCall![1]).toEqual({
      userId: '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3a',
    });
  });

  it('adds customer.zoneId filter when zoneId is provided', async () => {
    const { service, qb } = await buildService();

    await service.findAll(
      { zoneId: '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3b', page: 1, limit: 10 },
      'UTC',
    );

    const zoneCall = qb.andWhere.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('zoneId'),
    );
    expect(zoneCall).toBeDefined();
    expect(zoneCall![1]).toEqual({
      zoneId: '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3b',
    });
  });

  it('excludes soft-deleted payments unconditionally', async () => {
    const { service, qb } = await buildService();

    await service.findAll({ page: 1, limit: 10 }, 'UTC');

    const deletedAtCall = qb.andWhere.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('deletedAt IS NULL'),
    );
    expect(deletedAtCall).toBeDefined();
  });

  it('orders by payment.date DESC, payment.createdAt DESC, payment.id DESC', async () => {
    const { service, qb } = await buildService();

    await service.findAll({ page: 1, limit: 10 }, 'UTC');

    expect(qb.orderBy).toHaveBeenCalledWith('payment.date', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('payment.createdAt', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('payment.id', 'DESC');
  });

  it('applies skip and take from page/limit (1-indexed)', async () => {
    const { service, qb } = await buildService();

    await service.findAll({ page: 3, limit: 25 }, 'UTC');

    expect(qb.skip).toHaveBeenCalledWith(50);
    expect(qb.take).toHaveBeenCalledWith(25);
  });

  it('caps limit at 200', async () => {
    const { service, qb } = await buildService();

    await service.findAll({ page: 1, limit: 500 }, 'UTC');

    expect(qb.take).toHaveBeenCalledWith(200);
  });

  it('returns the result envelope with meta derived from rows.length and skip/take', async () => {
    const qb = buildQb();
    qb.getManyAndCount.mockResolvedValue([
      [buildHydratedRow(), { ...buildHydratedRow(), id: 'p-2' }],
      42,
    ]);
    const module = await Test.createTestingModule({
      providers: [
        CollectionsReportService,
        {
          provide: getRepositoryToken(Payment),
          useValue: { createQueryBuilder: () => qb },
        },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();
    const service = module.get(CollectionsReportService);

    const result = await service.findAll({ page: 2, limit: 10 }, 'UTC');

    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({
      total: 42,
      page: 2,
      limit: 10,
      totalPages: 5,
      currentPage: 2,
    });
  });

  it('uses page=1 as the canonical currentPage even on an empty result', async () => {
    const qb = buildQb();
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    const module = await Test.createTestingModule({
      providers: [
        CollectionsReportService,
        {
          provide: getRepositoryToken(Payment),
          useValue: { createQueryBuilder: () => qb },
        },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();
    const service = module.get(CollectionsReportService);

    const result = await service.findAll({ page: 7, limit: 10 }, 'UTC');

    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(0);
    expect(result.meta.currentPage).toBe(7);
  });

  it('uses leftJoinAndSelect for every relation (regression: leftJoin + addSelect caused ambiguous payment_id column)', async () => {
    // Repro of the production 500: with `leftJoin` (not `AndSelect`) plus
    // an `addSelect` listing root columns, `getManyAndCount` cloned the
    // builder in a way that re-added root columns and triggered an
    // ambiguous `payment_id` reference in Postgres. Fix: always use
    // `leftJoinAndSelect` for relations we project; let TypeORM auto-select
    // the root columns and only `addSelect` the `select:false` fields.
    const { service, qb } = await buildService();

    await service.findAll({ page: 1, limit: 10 }, 'UTC');

    expect(qb.leftJoin).not.toHaveBeenCalled();
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('payment.account', 'account');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('account.customer', 'customer');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('customer.zone', 'zone');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('payment.user', 'user');
  });

  it('addSelect is called only for the select:false payment.createdAt field', async () => {
    const { service, qb } = await buildService();

    await service.findAll({ page: 1, limit: 10 }, 'UTC');

    const addSelectCalls = qb.addSelect.mock.calls;
    expect(addSelectCalls).toHaveLength(1);
    const arg = addSelectCalls[0][0];
    const flattened = Array.isArray(arg) ? arg : [arg];
    expect(flattened).toEqual(['payment.createdAt']);
  });

  it('hydrated rows are mapped to the wire shape (nested account.customer.zone, ISO dates)', async () => {
    const hydratedRow = {
      id: 'p-1',
      date: new Date('2026-07-25T03:00:00.000Z'),
      createdAt: new Date('2026-07-25T03:05:00.000Z'),
      amount: 50,
      account: {
        id: 'a-1',
        amount: 1000,
        customer: {
          id: 'c-1',
          name: 'Ada',
          lastName: 'Lovelace',
          zone: { id: 'z-1', name: 'Zone A' },
        },
      },
      user: { id: 'u-1', name: 'Cobrador Uno' },
    };
    const qb = buildQb();
    qb.getManyAndCount.mockResolvedValue([[hydratedRow], 1]);
    const module = await Test.createTestingModule({
      providers: [
        CollectionsReportService,
        { provide: getRepositoryToken(Payment), useValue: { createQueryBuilder: () => qb } },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();
    const service = module.get(CollectionsReportService);

    const result = await service.findAll({ page: 1, limit: 10 }, 'UTC');

    expect(result.data).toEqual([
      {
        id: 'p-1',
        date: '2026-07-25T03:00:00.000Z',
        registeredAt: '2026-07-25T03:05:00.000Z',
        amount: 50,
        account: {
          id: 'a-1',
          amount: 1000,
          customer: {
            id: 'c-1',
            name: 'Ada',
            lastName: 'Lovelace',
            zone: { id: 'z-1', name: 'Zone A' },
          },
        },
        user: { id: 'u-1', name: 'Cobrador Uno' },
      },
    ]);
  });

  it('null zone and null user hydrate to null in the wire shape', async () => {
    const hydratedRow = {
      id: 'p-2',
      date: new Date('2026-07-25T03:00:00.000Z'),
      createdAt: new Date('2026-07-25T03:05:00.000Z'),
      amount: 25,
      account: {
        id: 'a-2',
        amount: 500,
        customer: {
          id: 'c-2',
          name: 'Grace',
          lastName: 'Hopper',
          zone: null,
        },
      },
      user: null,
    };
    const qb = buildQb();
    qb.getManyAndCount.mockResolvedValue([[hydratedRow], 1]);
    const module = await Test.createTestingModule({
      providers: [
        CollectionsReportService,
        { provide: getRepositoryToken(Payment), useValue: { createQueryBuilder: () => qb } },
        { provide: DataSource, useValue: { manager: {} } },
      ],
    }).compile();
    const service = module.get(CollectionsReportService);

    const result = await service.findAll({ page: 1, limit: 10 }, 'UTC');

    expect(result.data[0].account.customer.zone).toBeNull();
    expect(result.data[0].user).toBeNull();
  });
});
