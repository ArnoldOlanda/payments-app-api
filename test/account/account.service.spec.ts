import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  describe('handleCron()', () => {
    const buildUpdateQb = (
      setValue: unknown,
      affected: number,
      andWhereCalls: Array<unknown[]> = [],
    ) => {
      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockImplementation(function (this: any, value: unknown) {
          setValue = value;
          return this;
        }),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockImplementation(function (
          this: any,
          ...args: unknown[]
        ) {
          andWhereCalls.push(args);
          return this;
        }),
        execute: jest.fn().mockResolvedValue({ affected }),
      };
      (qb as any)._setValue = () => setValue;
      return qb;
    };

    it('should issue two bulk UPDATEs (overdue + finished) instead of N saves', async () => {
      const overdueSetRef = { value: undefined as unknown };
      const overdueWhereRef: Array<unknown[]> = [];
      const overdueQb = buildUpdateQb(
        overdueSetRef.value,
        3,
        overdueWhereRef,
      ) as any;
      overdueQb.set.mockImplementation((v: unknown) => {
        overdueSetRef.value = v;
        return overdueQb;
      });

      const finishedSetRef = { value: undefined as unknown };
      const finishedWhereRef: Array<unknown[]> = [];
      const finishedQb = buildUpdateQb(
        finishedSetRef.value,
        1,
        finishedWhereRef,
      ) as any;
      finishedQb.set.mockImplementation((v: unknown) => {
        finishedSetRef.value = v;
        return finishedQb;
      });

      accountRepo.createQueryBuilder
        .mockReturnValueOnce(overdueQb)
        .mockReturnValueOnce(finishedQb);

      await service.handleCron();

      expect(overdueQb.update).toHaveBeenCalledWith(Account);
      expect(finishedQb.update).toHaveBeenCalledWith(Account);

      expect(overdueSetRef.value).toEqual({ status: AccountStatus.OVERDUE });
      expect(finishedSetRef.value).toEqual({ status: AccountStatus.FINISHED });

      expect(overdueQb.where).toHaveBeenCalledWith('status = :active', {
        active: AccountStatus.ACTIVE,
      });
      expect(finishedQb.where).toHaveBeenCalledWith('status = :active', {
        active: AccountStatus.ACTIVE,
      });

      expect(overdueWhereRef.map((c) => c[0])).toEqual(
        expect.arrayContaining([
          'dueDate IS NOT NULL',
          'remainingBalance > 0',
          "dueDate AT TIME ZONE 'America/Lima' <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date",
        ]),
      );

      expect(finishedWhereRef.map((c) => c[0])).toEqual([
        'remainingBalance = 0',
      ]);

      expect(overdueQb.execute).toHaveBeenCalledTimes(1);
      expect(finishedQb.execute).toHaveBeenCalledTimes(1);
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it('should never use raw dueDate <= CURRENT_DATE without a TIME ZONE cast (regression: late-evening Lima cron bug)', async () => {
      const overdueQb = buildUpdateQb(undefined, 0);
      const finishedQb = buildUpdateQb(undefined, 0);
      accountRepo.createQueryBuilder
        .mockReturnValueOnce(overdueQb)
        .mockReturnValueOnce(finishedQb);

      await service.handleCron();

      const dueDateFilter = overdueQb.andWhere.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          /dueDate[\s\S]*<=/.test(call[0]) &&
          !/NOT NULL/i.test(call[0]),
      );

      expect(dueDateFilter).toBeDefined();
      expect(dueDateFilter![0]).toContain("'America/Lima'");
      expect(dueDateFilter![0]).not.toBe('dueDate <= CURRENT_DATE');
      expect(dueDateFilter![0]).not.toMatch(/<=\s*CURRENT_DATE\b/);
    });

    it('should NOT call find() (which would N+1)', async () => {
      const overdueQb = buildUpdateQb(undefined, 0);
      const finishedQb = buildUpdateQb(undefined, 0);
      accountRepo.createQueryBuilder
        .mockReturnValueOnce(overdueQb)
        .mockReturnValueOnce(finishedQb);

      await service.handleCron();

      expect(accountRepo.find).not.toHaveBeenCalled();
    });

    it('should swallow errors and not crash the cron loop', async () => {
      accountRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('db unavailable');
      });

      await expect(service.handleCron()).resolves.toBeUndefined();
    });

    it('should mark ACTIVE+overdue+balance>0 as OVERDUE (regression: original bug marked them FINISHED)', async () => {
      const overdueSetRef = { value: undefined as unknown };
      const overdueQb = buildUpdateQb(overdueSetRef.value, 5) as any;
      overdueQb.set.mockImplementation((v: unknown) => {
        overdueSetRef.value = v;
        return overdueQb;
      });
      const finishedQb = buildUpdateQb(undefined, 0);
      accountRepo.createQueryBuilder
        .mockReturnValueOnce(overdueQb)
        .mockReturnValueOnce(finishedQb);

      await service.handleCron();

      expect(overdueSetRef.value).toEqual({ status: AccountStatus.OVERDUE });
      expect(overdueSetRef.value).not.toEqual({
        status: AccountStatus.FINISHED,
      });
      expect(overdueQb.andWhere).toHaveBeenCalledWith('remainingBalance > 0');
    });

    it('should ONLY mark as FINISHED when remainingBalance = 0 (not based on dueDate)', async () => {
      const overdueQb = buildUpdateQb(undefined, 0);
      const finishedSetRef = { value: undefined as unknown };
      const finishedQb = buildUpdateQb(finishedSetRef.value, 2) as any;
      finishedQb.set.mockImplementation((v: unknown) => {
        finishedSetRef.value = v;
        return finishedQb;
      });
      accountRepo.createQueryBuilder
        .mockReturnValueOnce(overdueQb)
        .mockReturnValueOnce(finishedQb);

      await service.handleCron();

      expect(finishedSetRef.value).toEqual({ status: AccountStatus.FINISHED });
      const finishedAndWhere = finishedQb.andWhere.mock.calls;
      const finishedHasDueDateFilter = finishedAndWhere.some(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          /dueDate[\s\S]*<=/.test(call[0]) &&
          !/NOT NULL/i.test(call[0]),
      );
      expect(finishedHasDueDateFilter).toBe(false);
      expect(finishedQb.andWhere).toHaveBeenCalledWith('remainingBalance = 0');
    });
  });

  describe('update()', () => {
    let mockManager: any;
    let accountQb: any;

    const buildAccount = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'account-uuid-1',
        date: new Date('2025-01-01T00:00:00Z'),
        dueDate: new Date('2025-02-01T00:00:00Z'),
        amount: 1000,
        remainingBalance: 400,
        interest: 5,
        creditType: 'Diario',
        status: AccountStatus.ACTIVE,
        payments: [{ id: 'p-1', amount: 600, deletedAt: null }],
        customer: { id: 'c-1', zone: { id: 'zone-A' } },
        ...overrides,
      }) as any;

    beforeEach(() => {
      accountQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(() => mockManager.findOne()),
      };
      mockManager = {
        findOne: jest.fn(),
        createQueryBuilder: jest.fn(() => accountQb),
        save: jest.fn(async (data: unknown) => data),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: (m: unknown) => Promise<unknown>) => cb(mockManager),
      );
    });

    it('should recompute remainingBalance when amount increases above payments sum', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);

      await service.update('account-uuid-1', { amount: 1500 }, adminActor);

      expect(account.amount).toBe(1500);
      expect(account.remainingBalance).toBe(900);
      expect(mockManager.save).toHaveBeenCalledWith(account);
    });

    it('should recompute remainingBalance when amount decreases but stays above payments sum', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);

      await service.update('account-uuid-1', { amount: 800 }, adminActor);

      expect(account.amount).toBe(800);
      expect(account.remainingBalance).toBe(200);
    });

    it('should flip status to FINISHED when amount equals payments sum', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);

      await service.update('account-uuid-1', { amount: 600 }, adminActor);

      expect(account.amount).toBe(600);
      expect(account.remainingBalance).toBe(0);
      expect(account.status).toBe(AccountStatus.FINISHED);
    });

    it('should reject with BadRequestException when amount is below payments sum', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);

      await expect(
        service.update('account-uuid-1', { amount: 500 }, adminActor),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
      expect(account.amount).toBe(1000);
      expect(account.remainingBalance).toBe(400);
    });

    it('should reactivate a FINISHED account when principal grows', async () => {
      const account = buildAccount({
        amount: 600,
        remainingBalance: 0,
        status: AccountStatus.FINISHED,
        payments: [],
      });
      mockManager.findOne.mockResolvedValue(account);

      await service.update('account-uuid-1', { amount: 1200 }, adminActor);

      expect(account.amount).toBe(1200);
      expect(account.remainingBalance).toBe(1200);
      expect(account.status).toBe(AccountStatus.ACTIVE);
    });

    it('should reject dueDate when it is not after the stored date', async () => {
      const account = buildAccount({ date: new Date('2025-01-01') });
      mockManager.findOne.mockResolvedValue(account);

      await expect(
        service.update(
          'account-uuid-1',
          { dueDate: new Date('2024-12-31') },
          adminActor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should apply dueDate when it is after the stored date', async () => {
      const account = buildAccount({ date: new Date('2025-01-01') });
      mockManager.findOne.mockResolvedValue(account);
      const newDueDate = new Date('2025-03-01');

      await service.update(
        'account-uuid-1',
        { dueDate: newDueDate },
        adminActor,
      );

      expect(account.dueDate).toEqual(newDueDate);
    });

    it('should ignore fields outside amount and dueDate', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);
      const originalDate = account.date;
      const originalInterest = account.interest;
      const originalCreditType = account.creditType;

      await service.update(
        'account-uuid-1',
        {
          amount: 1500,
          dueDate: new Date('2025-04-01'),
          date: new Date('1999-01-01'),
          creditType: 'Semanal' as any,
          customerId: 'c-other',
          interest: 999,
        } as any,
        adminActor,
      );

      expect(account.date).toBe(originalDate);
      expect(account.interest).toBe(originalInterest);
      expect(account.creditType).toBe(originalCreditType);
    });

    it('should leave amount and remainingBalance unchanged when only dueDate is sent', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);

      await service.update(
        'account-uuid-1',
        { dueDate: new Date('2025-04-01') },
        adminActor,
      );

      expect(account.amount).toBe(1000);
      expect(account.remainingBalance).toBe(400);
    });

    it('should reject with NotFoundException when the account does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { amount: 1500 }, adminActor),
      ).rejects.toThrow(NotFoundException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should reject Prestamista when account customer zone is outside their zones', async () => {
      const account = buildAccount({
        customer: { id: 'c-1', zone: { id: 'zone-foreign' } } as any,
      });
      mockManager.findOne.mockResolvedValue(account);

      await expect(
        service.update('account-uuid-1', { amount: 1500 }, prestamistaActor),
      ).rejects.toThrow(ForbiddenException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should persist the update without invalidating cache (cache removed)', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);

      await service.update('account-uuid-1', { amount: 1500 }, adminActor);

      expect(mockManager.save).toHaveBeenCalledTimes(1);
    });

    it('should not call save when the transaction throws', async () => {
      mockManager.findOne.mockRejectedValue(new Error('db down'));

      await expect(
        service.update('account-uuid-1', { amount: 1500 }, adminActor),
      ).rejects.toThrow('db down');
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should wrap update in a transaction with pessimistic_write lock on the account row', async () => {
      const account = buildAccount();
      mockManager.findOne.mockResolvedValue(account);

      await service.update('account-uuid-1', { amount: 1500 }, adminActor);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.createQueryBuilder).toHaveBeenCalledWith(
        Account,
        'account',
      );
      expect(accountQb.where).toHaveBeenCalledWith('account.id = :id', {
        id: 'account-uuid-1',
      });
      expect(accountQb.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
        undefined,
        ['account'],
      );
    });
  });
});
