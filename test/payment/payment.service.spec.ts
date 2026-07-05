import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { PaymentService } from 'src/payment/payment.service';
import { Payment } from 'src/payment/entities/payment.entity';
import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { User } from 'src/user/entities/user.entity';
import { AccountService } from 'src/account/account.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let accountRepo: jest.Mocked<any>;
  let paymentRepo: jest.Mocked<any>;
  let userRepo: jest.Mocked<any>;
  let accountService: jest.Mocked<AccountService>;
  let dataSource: jest.Mocked<DataSource>;
  let mockManager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
  };

  const buildAccount = (overrides: Partial<Account> = {}): Account =>
    ({
      id: 'account-uuid-1',
      remainingBalance: 1000,
      status: AccountStatus.ACTIVE,
      ...overrides,
    }) as Account;

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-uuid-1',
      name: 'Cobrador',
      email: 'c@example.com',
      ...overrides,
    }) as User;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async (data) => data),
      softDelete: jest.fn(async () => ({ affected: 1 })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn((data) => data),
            save: jest.fn(),
            preload: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: AccountService,
          useValue: {
            invalidateCache: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (cb: any) => cb(mockManager)),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    accountRepo = module.get(getRepositoryToken(Account));
    paymentRepo = module.get(getRepositoryToken(Payment));
    userRepo = module.get(getRepositoryToken(User));
    accountService = module.get(AccountService);
    dataSource = module.get(DataSource);

    mockManager.findOne.mockImplementation((entity: any, options: any) => {
      if (entity === Account) return accountRepo.findOne(options);
      if (entity === Payment) return paymentRepo.findOne(options);
      if (entity === User) return userRepo.findOne(options);
      return Promise.resolve(null);
    });
  });

  describe('create()', () => {
    const dto = {
      accountId: 'account-uuid-1',
      userId: 'user-uuid-1',
      date: new Date('2025-01-15T10:00:00Z'),
      amount: 200,
    };

    it('should reject when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(accountService.invalidateCache).not.toHaveBeenCalled();
    });

    it('should reject when account is not found', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should reject with BadRequestException when account is FINISHED (business rule, not 404)', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ status: AccountStatus.FINISHED }),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should reject with BadRequestException when amount exceeds remaining balance', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ remainingBalance: 100 }),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should wrap operations in a transaction with pessimistic_write lock on the account', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ remainingBalance: 1000 }),
      );

      await service.create(dto);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(accountRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: dto.accountId },
          lock: { mode: 'pessimistic_write' },
        }),
      );
    });

    it('should deduct amount and keep status ACTIVE when balance remains > 0', async () => {
      const account = buildAccount({ remainingBalance: 1000 });
      userRepo.findOne.mockResolvedValue(buildUser());
      accountRepo.findOne.mockResolvedValue(account);

      await service.create(dto);

      expect(account.remainingBalance).toBe(800);
      expect(account.status).toBe(AccountStatus.ACTIVE);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(accountService.invalidateCache).toHaveBeenCalledTimes(1);
    });

    it('should flip status to FINISHED when balance hits exactly 0', async () => {
      const account = buildAccount({ remainingBalance: 200 });
      userRepo.findOne.mockResolvedValue(buildUser());
      accountRepo.findOne.mockResolvedValue(account);

      await service.create(dto);

      expect(account.remainingBalance).toBe(0);
      expect(account.status).toBe(AccountStatus.FINISHED);
    });

    it('should NOT call invalidateCache if the transaction throws', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      accountRepo.findOne.mockRejectedValue(new Error('db down'));

      await expect(service.create(dto)).rejects.toThrow('db down');
      expect(accountService.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    const buildPayment = (overrides: Partial<Payment> = {}): Payment =>
      ({
        id: 'payment-uuid-1',
        amount: 100,
        accountId: 'account-uuid-1',
        account: { id: 'account-uuid-1' } as any,
        ...overrides,
      }) as Payment;

    it('should reject when payment is not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', { amount: 50 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject when target account is not found', async () => {
      paymentRepo.findOne.mockResolvedValue(buildPayment());
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('payment-uuid-1', { amount: 50 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when new amount would push balance below 0', async () => {
      paymentRepo.findOne.mockResolvedValue(buildPayment({ amount: 100 }));
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ remainingBalance: 50 }),
      );

      await expect(
        service.update('payment-uuid-1', { amount: 200 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should refund the previous amount and deduct the new one on amount change', async () => {
      const account = buildAccount({ remainingBalance: 500 });
      paymentRepo.findOne.mockResolvedValue(buildPayment({ amount: 100 }));
      accountRepo.findOne.mockResolvedValue(account);

      const updated = await service.update('payment-uuid-1', { amount: 300 });

      expect(account.remainingBalance).toBe(300);
      expect((updated as Payment).amount).toBe(300);
      expect(mockManager.save).toHaveBeenCalledWith(account);
      expect(accountService.invalidateCache).toHaveBeenCalledTimes(1);
    });

    it('should revert status from FINISHED to ACTIVE when refund brings balance > 0', async () => {
      const account = buildAccount({
        remainingBalance: 0,
        status: AccountStatus.FINISHED,
      });
      paymentRepo.findOne.mockResolvedValue(buildPayment({ amount: 100 }));
      accountRepo.findOne.mockResolvedValue(account);

      await service.update('payment-uuid-1', { amount: 50 });

      expect(account.remainingBalance).toBe(50);
      expect(account.status).toBe(AccountStatus.ACTIVE);
    });

    it('should reject when accountId differs from the current payment account (no transfers)', async () => {
      const account = buildAccount({ remainingBalance: 500 });
      paymentRepo.findOne.mockResolvedValue(buildPayment({ amount: 100 }));
      accountRepo.findOne.mockResolvedValue(account);

      await expect(
        service.update('payment-uuid-1', { accountId: 'different-account' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockManager.save).not.toHaveBeenCalled();
      expect(accountService.invalidateCache).not.toHaveBeenCalled();
    });

    it('should accept accountId when it matches the current payment account (idempotent)', async () => {
      const account = buildAccount({ remainingBalance: 500 });
      paymentRepo.findOne.mockResolvedValue(buildPayment({ amount: 100 }));
      accountRepo.findOne.mockResolvedValue(account);

      await service.update('payment-uuid-1', {
        amount: 200,
        accountId: 'account-uuid-1',
      });

      expect(account.remainingBalance).toBe(400);
    });
  });

  describe('remove()', () => {
    it('should reject when payment is not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should refund the amount to the account', async () => {
      const account = buildAccount({ remainingBalance: 700 });
      paymentRepo.findOne.mockResolvedValue({
        id: 'payment-uuid-1',
        amount: 300,
        account: { id: 'account-uuid-1' },
      } as any);
      accountRepo.findOne.mockResolvedValue(account);

      const message = await service.remove('payment-uuid-1');

      expect(account.remainingBalance).toBe(1000);
      expect(mockManager.save).toHaveBeenCalledWith(account);
      expect(mockManager.softDelete).toHaveBeenCalledWith(
        Payment,
        'payment-uuid-1',
      );
      expect(accountService.invalidateCache).toHaveBeenCalledTimes(1);
      expect(message).toBe('Pago eliminado con éxito');
    });

    it('should revert status from FINISHED to ACTIVE when refund brings balance > 0', async () => {
      const account = buildAccount({
        remainingBalance: 0,
        status: AccountStatus.FINISHED,
      });
      paymentRepo.findOne.mockResolvedValue({
        id: 'payment-uuid-1',
        amount: 500,
        account: { id: 'account-uuid-1' },
      } as any);
      accountRepo.findOne.mockResolvedValue(account);

      await service.remove('payment-uuid-1');

      expect(account.remainingBalance).toBe(500);
      expect(account.status).toBe(AccountStatus.ACTIVE);
    });

    it('should not call invalidateCache if the transaction throws', async () => {
      paymentRepo.findOne.mockRejectedValue(new Error('db down'));

      await expect(service.remove('payment-uuid-1')).rejects.toThrow('db down');
      expect(accountService.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('findAll() / findOne()', () => {
    it('findAll filters by accountId when provided', async () => {
      paymentRepo.find.mockResolvedValue([]);

      await service.findAll('account-uuid-1');

      expect(paymentRepo.find).toHaveBeenCalledWith({
        where: { account: { id: 'account-uuid-1' } },
        relations: ['user'],
      });
    });

    it('findAll returns all when no accountId', async () => {
      paymentRepo.find.mockResolvedValue([]);

      await service.findAll(undefined);

      expect(paymentRepo.find).toHaveBeenCalledWith();
    });

    it('findOne rejects when payment does not exist', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
