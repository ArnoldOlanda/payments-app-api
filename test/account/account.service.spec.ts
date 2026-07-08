import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { AccountService } from 'src/account/account.service';
import { Account } from 'src/account/entities/account.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { Payment } from 'src/payment/entities/payment.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { User } from 'src/user/entities/user.entity';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { Actor } from 'src/auth/types/actor.type';

describe('AccountService', () => {
  let service: AccountService;
  let accountRepo: jest.Mocked<any>;
  let customerRepo: jest.Mocked<any>;
  let dataSource: jest.Mocked<DataSource>;
  let cacheStore: Map<string, any>;
  let cacheDelSpy: jest.Mock;

  const adminActor = { id: 'admin-1', role: ValidRole.ADMIN } as Actor;
  const prestamistaActor = {
    id: 'prest-1',
    role: ValidRole.PRESTAMISTA,
  } as Actor;

  const stubManager = (userZoneIds: string[]) => {
    const manager: Partial<EntityManager> = {
      findOne: jest.fn().mockImplementation((entity: any) => {
        if (entity === User) {
          return Promise.resolve({
            id: 'u-1',
            zones: userZoneIds.map((id) => ({ id })),
          });
        }
        if (entity === Customer) {
          return Promise.resolve({ id: 'c-1', zone: { id: userZoneIds[0] } });
        }
        return Promise.resolve(null);
      }),
    };
    return manager as EntityManager;
  };

  beforeEach(async () => {
    cacheStore = new Map();
    cacheDelSpy = jest.fn(async (key: string) => {
      cacheStore.delete(key);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn((data) => data),
            save: jest.fn(async (data) => data),
            preload: jest.fn(),
            softDelete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: { softDelete: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(async (key: string) => cacheStore.get(key)),
            set: jest.fn(async (key: string, value: any) => {
              cacheStore.set(key, value);
            }),
            del: cacheDelSpy,
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
            manager: {} as EntityManager,
          },
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
    accountRepo = module.get(getRepositoryToken(Account));
    customerRepo = module.get(getRepositoryToken(Customer));
    dataSource = module.get(DataSource);
  });

  describe('findOne()', () => {
    it('should resolve with the account when found (admin)', async () => {
      const account = { id: 'a-1' } as Account;
      accountRepo.findOne.mockResolvedValue(account);

      await expect(service.findOne('a-1', adminActor)).resolves.toBe(account);
    });

    it('should throw NotFoundException when missing', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', adminActor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for Prestamista when customer zone is not in their zones', async () => {
      accountRepo.findOne.mockResolvedValue({
        id: 'a-1',
        customer: { zone: { id: 'zone-foreign' } },
      } as any);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await expect(service.findOne('a-1', prestamistaActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow Prestamista when customer zone is in their zones', async () => {
      const account = {
        id: 'a-1',
        customer: { zone: { id: 'zone-A' } },
      } as any;
      accountRepo.findOne.mockResolvedValue(account);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await expect(service.findOne('a-1', prestamistaActor)).resolves.toBe(
        account,
      );
    });
  });

  describe('create()', () => {
    it('should reject with NotFoundException when customer does not exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          {
            customerId: 'c-1',
            creditType: 'Diario' as any,
            date: new Date(),
            dueDate: new Date(),
            amount: 100,
            interest: 5,
          },
          adminActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject Prestamista when customer zone is not in their zones', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'c-1',
        zone: { id: 'zone-foreign' },
      } as any);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await expect(
        service.create(
          {
            customerId: 'c-1',
            creditType: 'Diario' as any,
            date: new Date(),
            dueDate: new Date(),
            amount: 100,
            interest: 5,
          },
          prestamistaActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Admin to skip zone-scope', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'c-1',
        zone: { id: 'zone-foreign' },
      } as any);

      await service.create(
        {
          customerId: 'c-1',
          creditType: 'Diario' as any,
          date: new Date(),
          dueDate: new Date(),
          amount: 100,
          interest: 5,
        },
        adminActor,
      );

      expect(accountRepo.save).toHaveBeenCalled();
    });

    it('should allow Prestamista when customer zone is in their zones', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'c-1',
        zone: { id: 'zone-A' },
      } as any);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await service.create(
        {
          customerId: 'c-1',
          creditType: 'Diario' as any,
          date: new Date(),
          dueDate: new Date(),
          amount: 100,
          interest: 5,
        },
        prestamistaActor,
      );

      expect(accountRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('should include zone filter for Prestamista', async () => {
      (dataSource.manager as any) = stubManager(['zone-A']);

      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'a-1' }], 1]),
      };
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 10 } as any, prestamistaActor);

      const andWhereCalls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(
        andWhereCalls.some((s: string) =>
          s.includes('zone.id IN (:...userZoneIds)'),
        ),
      ).toBe(true);
    });

    it('should NOT include zone filter for Admin', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'a-1' }], 1]),
      };
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 10 } as any, adminActor);

      const andWhereCalls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(andWhereCalls.some((s: string) => s.includes('userZoneIds'))).toBe(
        false,
      );
    });

    it('should short-circuit to empty result for Prestamista with no zones', async () => {
      (dataSource.manager as any) = stubManager([]);

      const result = (await service.findAll(
        { page: 1, limit: 10 } as any,
        prestamistaActor,
      )) as { data: unknown[]; meta: { total: number } };

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(accountRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('invalidateCache()', () => {
    it('should delete every key previously written by findAll', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'a-1' }], 1]),
      };
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 10 } as any, adminActor);

      expect(cacheStore.size).toBe(1);
      const [storedKey] = Array.from(cacheStore.keys());

      await service.invalidateCache();

      expect(cacheDelSpy).toHaveBeenCalledWith(storedKey);
      expect(cacheStore.has(storedKey)).toBe(false);
    });
  });

  describe('handleCron()', () => {
    it('should run a single bulk UPDATE instead of N saves', async () => {
      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      accountRepo.createQueryBuilder.mockReturnValue(updateQb);

      await service.handleCron();

      expect(updateQb.update).toHaveBeenCalledWith(Account);
      expect(updateQb.set).toHaveBeenCalledWith({
        status: AccountStatus.FINISHED,
      });
      expect(updateQb.where).toHaveBeenCalledWith('status = :active', {
        active: AccountStatus.ACTIVE,
      });
      expect(updateQb.andWhere).toHaveBeenCalledWith('dueDate IS NOT NULL');
      expect(updateQb.andWhere).toHaveBeenCalledWith('dueDate <= CURRENT_DATE');
      expect(updateQb.execute).toHaveBeenCalledTimes(1);
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT call find() (which would N+1)', async () => {
      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      accountRepo.createQueryBuilder.mockReturnValue(updateQb);

      await service.handleCron();

      expect(accountRepo.find).not.toHaveBeenCalled();
    });

    it('should swallow errors and not crash the cron loop', async () => {
      accountRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('db unavailable');
      });

      await expect(service.handleCron()).resolves.toBeUndefined();
    });

    it('should invalidate cache only when something changed', async () => {
      const updateQbNoop = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      accountRepo.createQueryBuilder.mockReturnValue(updateQbNoop);

      await service.handleCron();
      expect(cacheDelSpy).not.toHaveBeenCalled();

      const updateQbChanged = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      accountRepo.createQueryBuilder.mockReturnValue(updateQbChanged);

      await service.handleCron();
      expect(cacheDelSpy).toHaveBeenCalledTimes(0);
    });
  });
});
