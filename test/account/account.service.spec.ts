import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AccountService } from 'src/account/account.service';
import { Account } from 'src/account/entities/account.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { Payment } from 'src/payment/entities/payment.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';

describe('AccountService', () => {
  let service: AccountService;
  let accountRepo: jest.Mocked<any>;
  let cacheStore: Map<string, any>;
  let cacheDelSpy: jest.Mock;

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
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
    accountRepo = module.get(getRepositoryToken(Account));
  });

  describe('findOne()', () => {
    it('should resolve with the account when found', async () => {
      const account = { id: 'a-1' } as Account;
      accountRepo.findOne.mockResolvedValue(account);

      await expect(service.findOne('a-1')).resolves.toBe(account);
    });

    it('should throw NotFoundException when missing', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('invalidateCache()', () => {
    it('should delete every key previously written by findAll/getAccountsByCustomer', async () => {
      accountRepo.findOne.mockResolvedValue({ id: 'a-1' } as any);

      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'a-1' }], 1]),
      };
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({
        page: 1,
        limit: 10,
      } as any);

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
