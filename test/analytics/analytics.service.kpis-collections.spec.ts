import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AnalyticsService } from 'src/analytics/analytics.service';
import { Account } from 'src/account/entities/account.entity';
import { Payment } from 'src/payment/entities/payment.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { Actor } from 'src/auth/types/actor.type';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { dayStart, dayEnd } from 'src/common/datetime/tempo';

/**
 * Builds a fresh QueryBuilder mock whose chainable methods return itself.
 * `where` is special: it captures its arguments so we can assert the
 * TZ-derived boundary instants the service computed.
 */
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
    cache?: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  } = {},
) {
  const paymentRepo = opts.paymentRepo ?? {
    createQueryBuilder: jest.fn(() => buildCountQb()),
  };
  const cache = opts.cache ?? {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn(),
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
      { provide: CACHE_MANAGER, useValue: cache },
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
  return { service: module.get(AnalyticsService), paymentRepo, cache };
}

describe('AnalyticsService.getKpis() — TZ-aware', () => {
  const adminActor: Actor = {
    id: 'admin-1',
    role: ValidRole.ADMIN,
    timezone: 'UTC',
  } as Actor;

  it('computes "today" range using the actor TZ, not the container TZ', async () => {
    // Force "now" to 2025-06-15T15:00:00Z, which is 2025-06-16 00:00 in Tokyo.
    // Expected Tokyo dayStart == 2025-06-15T15:00:00Z.
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
    // 2025-06-16T02:00:00Z is 2025-06-15 23:00 ART — "today" in ART is 2025-06-15.
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

  it('includes the TZ in the cache key (no cross-TZ collisions)', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn(),
    };
    const { service } = await buildService({ cache });

    await service.getKpis(undefined, adminActor, 'Asia/Tokyo');
    await service.getKpis(
      undefined,
      adminActor,
      'America/Argentina/Buenos_Aires',
    );
    await service.getKpis(undefined, adminActor, 'Europe/Madrid');

    const cacheKeys = cache.get.mock.calls.map((c) => c[0] as string);
    expect(new Set(cacheKeys).size).toBe(3);
    expect(cacheKeys[0]).toContain('Asia/Tokyo');
    expect(cacheKeys[1]).toContain('America/Argentina/Buenos_Aires');
    expect(cacheKeys[2]).toContain('Europe/Madrid');
  });
});
