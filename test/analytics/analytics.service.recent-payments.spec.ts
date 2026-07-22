import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AnalyticsService } from 'src/analytics/analytics.service';
import { Account } from 'src/account/entities/account.entity';
import { Payment } from 'src/payment/entities/payment.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { Actor } from 'src/auth/types/actor.type';
import { ValidRole } from 'src/auth/enums/validRoles.enum';

describe('AnalyticsService.getRecentPayments()', () => {
  let service: AnalyticsService;
  let paymentRepo: { createQueryBuilder: jest.Mock };
  let accountRepo: { createQueryBuilder: jest.Mock };
  let customerRepo: { createQueryBuilder: jest.Mock };
  let cacheStore: Map<string, unknown>;
  let cacheGetSpy: jest.Mock;
  let cacheSetSpy: jest.Mock;
  let dataSource: { manager: { findOne: jest.Mock } };

  const adminActor: Actor = { id: 'admin-1', role: ValidRole.ADMIN } as Actor;
  const prestamistaActor: Actor = {
    id: 'prest-1',
    role: ValidRole.PRESTAMISTA,
  } as Actor;

  const buildQb = () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'payment-1' }]),
      getCount: jest.fn().mockResolvedValue(1),
    };
    return qb;
  };

  const buildModule = async () => {
    paymentRepo = { createQueryBuilder: jest.fn() };
    accountRepo = { createQueryBuilder: jest.fn() };
    customerRepo = { createQueryBuilder: jest.fn() };
    cacheStore = new Map();
    cacheGetSpy = jest.fn(async (key: string) => cacheStore.get(key) ?? null);
    cacheSetSpy = jest.fn(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
    });
    dataSource = { manager: { findOne: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        {
          provide: CACHE_MANAGER,
          useValue: { get: cacheGetSpy, set: cacheSetSpy },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  };

  beforeEach(async () => {
    await buildModule();
  });

  it('returns the cached value without hitting the repository when the cache has a hit', async () => {
    const cached = [{ id: 'cached-1', amount: 100 }];
    const from = new Date('2026-07-21T05:00:00.000Z');
    const to = new Date('2026-07-22T04:59:59.999Z');
    const cacheKey = `analytics:recent-payments:v2:${adminActor.id}:ALL:10:${from.toISOString()}:${to.toISOString()}`;
    cacheStore.set(cacheKey, cached);

    const result = await service.getRecentPayments(
      undefined,
      10,
      from,
      to,
      adminActor,
    );

    expect(result).toBe(cached);
    expect(paymentRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('filters by from/to with BETWEEN when both are provided', async () => {
    const qb = buildQb();
    paymentRepo.createQueryBuilder.mockReturnValue(qb);

    const from = new Date('2026-07-21T05:00:00.000Z');
    const to = new Date('2026-07-22T04:59:59.999Z');

    await service.getRecentPayments(undefined, 10, from, to, adminActor);

    expect(qb.where).toHaveBeenCalledWith(
      'payment.date BETWEEN :from AND :to',
      expect.objectContaining({ from, to }),
    );
  });

  it('omits the BETWEEN filter when from/to are not both provided', async () => {
    const qb = buildQb();
    paymentRepo.createQueryBuilder.mockReturnValue(qb);

    await service.getRecentPayments(
      undefined,
      10,
      undefined,
      undefined,
      adminActor,
    );

    expect(qb.where).not.toHaveBeenCalled();
  });

  it('selects payment.createdAt so cards can render real timestamps (regression: cards showing 00:00 bug)', async () => {
    const qb = buildQb();
    paymentRepo.createQueryBuilder.mockReturnValue(qb);

    const from = new Date('2026-07-21T05:00:00.000Z');
    const to = new Date('2026-07-22T04:59:59.999Z');

    await service.getRecentPayments(undefined, 10, from, to, adminActor);

    const addSelectArgs = qb.addSelect.mock.calls;
    const createsAtSelect = addSelectArgs.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('createdAt'),
    );

    expect(createsAtSelect).toBeDefined();
    expect(createsAtSelect![0]).toBe('payment.createdAt');
  });

  it('orders by payment.date DESC and applies take(limit)', async () => {
    const qb = buildQb();
    paymentRepo.createQueryBuilder.mockReturnValue(qb);

    await service.getRecentPayments(
      undefined,
      25,
      undefined,
      undefined,
      adminActor,
    );

    expect(qb.orderBy).toHaveBeenCalledWith('payment.date', 'DESC');
    expect(qb.take).toHaveBeenCalledWith(25);
  });

  it('caches the result after a fresh DB read', async () => {
    const qb = buildQb();
    paymentRepo.createQueryBuilder.mockReturnValue(qb);

    const from = new Date('2026-07-21T05:00:00.000Z');
    const to = new Date('2026-07-22T04:59:59.999Z');

    await service.getRecentPayments(undefined, 10, from, to, adminActor);

    expect(cacheSetSpy).toHaveBeenCalledTimes(1);
    const [key, value] = cacheSetSpy.mock.calls[0];
    expect(typeof key).toBe('string');
    expect(key).toContain('analytics:recent-payments');
    expect(key).toMatch(/^analytics:recent-payments:v2:/);
    expect(value).toEqual([{ id: 'payment-1' }]);
  });

  it('rejects a Prestamista that requests a zone outside their assigned zones', async () => {
    (dataSource.manager as unknown as { findOne: jest.Mock }).findOne = jest
      .fn()
      .mockResolvedValue({
        id: prestamistaActor.id,
        zones: [{ id: 'zone-A' }],
      });

    await expect(
      service.getRecentPayments(
        'zone-other',
        10,
        undefined,
        undefined,
        prestamistaActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
