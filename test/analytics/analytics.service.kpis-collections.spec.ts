import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AnalyticsService } from 'src/analytics/analytics.service';
import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { Payment } from 'src/payment/entities/payment.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { Actor } from 'src/auth/types/actor.type';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { dayStart, dayEnd } from 'src/common/datetime/tempo';

function buildCountQb() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
  };
  return qb;
}

async function buildService(
  opts: {
    paymentRepo?: { createQueryBuilder: jest.Mock };
  } = {},
) {
  const paymentRepo = opts.paymentRepo ?? {
    createQueryBuilder: jest.fn(() => buildCountQb()),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AnalyticsService,
      {
        provide: getRepositoryToken(Account),
        useValue: { createQueryBuilder: jest.fn(() => buildCountQb()) },
      },
      { provide: getRepositoryToken(Payment), useValue: paymentRepo },
      {
        provide: getRepositoryToken(Customer),
        useValue: { createQueryBuilder: jest.fn(() => buildCountQb()) },
      },
      {
        provide: DataSource,
        useValue: {
          manager: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
          },
        },
      },
    ],
  }).compile();
  return { service: module.get(AnalyticsService), paymentRepo };
}

describe('AnalyticsService.getKpis() — TZ-aware', () => {
  const adminActor: Actor = {
    id: 'admin-1',
    role: ValidRole.ADMIN,
    timezone: 'UTC',
  } as Actor;

  it('computes "today" range using the actor TZ, not the container TZ', async () => {
    const fixedInstant = new Date('2025-06-15T15:00:00Z');
    jest.useFakeTimers().setSystemTime(fixedInstant);

    try {
      const { service, paymentRepo } = await buildService();
      await service.getKpis(undefined, adminActor, 'Asia/Tokyo');

      const qb = paymentRepo.createQueryBuilder.mock.results[0].value;
      const whereArgs = qb.where.mock.calls[0];
      expect(whereArgs).toBeDefined();
      const params = whereArgs[1];
      expect(params.from).toEqual(dayStart(fixedInstant, 'Asia/Tokyo'));
      expect(params.to).toEqual(dayEnd(fixedInstant, 'Asia/Tokyo'));
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses America/Argentina/Buenos_Aires boundaries when tz = ART', async () => {
    const fixedInstant = new Date('2025-06-16T02:00:00Z');
    jest.useFakeTimers().setSystemTime(fixedInstant);

    try {
      const { service, paymentRepo } = await buildService();
      await service.getKpis(
        undefined,
        adminActor,
        'America/Argentina/Buenos_Aires',
      );

      const qb = paymentRepo.createQueryBuilder.mock.results[0].value;
      const params = qb.where.mock.calls[0][1];
      expect(params.from).toEqual(
        dayStart(fixedInstant, 'America/Argentina/Buenos_Aires'),
      );
      expect(params.to).toEqual(
        dayEnd(fixedInstant, 'America/Argentina/Buenos_Aires'),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('AnalyticsService — OVERDUE counts as debt', () => {
  const adminActor: Actor = {
    id: 'admin-1',
    role: ValidRole.ADMIN,
    timezone: 'UTC',
  } as Actor;

  it('getKpis() should filter active accounts and pending balance by [ACTIVE, OVERDUE]', async () => {
    const activeAccountQb = buildCountQb();
    const pendingQb = buildCountQb();
    const accountRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(activeAccountQb)
        .mockReturnValueOnce(pendingQb),
    };
    const paymentRepo = { createQueryBuilder: jest.fn(() => buildCountQb()) };
    const customerRepo = { createQueryBuilder: jest.fn(() => buildCountQb()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        {
          provide: DataSource,
          useValue: {
            manager: {
              find: jest.fn().mockResolvedValue([]),
              findOne: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    await service.getKpis(undefined, adminActor, 'UTC');

    const activeWhere = activeAccountQb.where.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && /status/.test(c[0] as string),
    );
    const pendingWhere = pendingQb.where.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && /status/.test(c[0] as string),
    );

    expect(activeWhere).toBeDefined();
    expect(activeWhere![0]).toBe('account.status IN (:...activeStatuses)');
    expect(activeWhere![1].activeStatuses).toEqual(
      expect.arrayContaining([AccountStatus.ACTIVE, AccountStatus.OVERDUE]),
    );
    expect(activeWhere![1].activeStatuses).not.toEqual([AccountStatus.ACTIVE]);

    expect(pendingWhere).toBeDefined();
    expect(pendingWhere![0]).toBe('account.status IN (:...activeStatuses)');
    expect(pendingWhere![1].activeStatuses).toEqual(
      expect.arrayContaining([AccountStatus.ACTIVE, AccountStatus.OVERDUE]),
    );
  });

  it('getZoneDistribution() should filter by [ACTIVE, OVERDUE]', async () => {
    const rawQb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const accountRepo = { createQueryBuilder: jest.fn(() => rawQb) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(Payment), useValue: {
          createQueryBuilder: jest.fn(() => buildCountQb()),
        } },
        { provide: getRepositoryToken(Customer), useValue: {
          createQueryBuilder: jest.fn(() => buildCountQb()),
        } },
        {
          provide: DataSource,
          useValue: {
            manager: {
              find: jest.fn().mockResolvedValue([]),
              findOne: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    await service.getZoneDistribution(undefined, adminActor);

    const statusWhere = rawQb.where.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && /status/.test(c[0] as string),
    );
    expect(statusWhere).toBeDefined();
    expect(statusWhere![0]).toBe('account.status IN (:...activeStatuses)');
    expect(statusWhere![1].activeStatuses).toEqual(
      expect.arrayContaining([AccountStatus.ACTIVE, AccountStatus.OVERDUE]),
    );
  });
});
