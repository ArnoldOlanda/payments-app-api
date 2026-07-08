import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { PaymentService } from 'src/payment/payment.service';
import { Payment } from 'src/payment/entities/payment.entity';
import { Account } from 'src/account/entities/account.entity';
import { AccountStatus } from 'src/account/enums/account-status.enum';
import { User } from 'src/user/entities/user.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { AccountService } from 'src/account/account.service';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { Actor } from 'src/auth/types/actor.type';

describe('PaymentService', () => {
  let service: PaymentService;
  let accountRepo: jest.Mocked<any>;
  let paymentRepo: jest.Mocked<any>;
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

  const adminActor = { id: 'admin-1', role: ValidRole.ADMIN } as Actor;
  const prestamistaActor = {
    id: 'prest-1',
    role: ValidRole.PRESTAMISTA,
  } as Actor;

  const stubManager = (userZoneIds: string[]): EntityManager => {
    const userWithZones = {
      id: 'prest-1',
      zones: userZoneIds.map((id) => ({ id })),
    };
    return {
      findOne: jest.fn().mockImplementation((entity: any, options: any) => {
        if (entity === Account) return accountRepo.findOne(options);
        if (entity === Payment) return paymentRepo.findOne(options);
        if (entity === User) return Promise.resolve(userWithZones);
        if (entity === Customer) {
          const customerZoneId = options?.where?.zone?.id ?? userZoneIds[0];
          return Promise.resolve({ id: 'c-1', zone: { id: customerZoneId } });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async (data) => data),
      softDelete: jest.fn(async () => ({ affected: 1 })),
    } as unknown as EntityManager;
  };

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
    accountService = module.get(AccountService);
    dataSource = module.get(DataSource);

    mockManager.findOne.mockImplementation((entity: any, options: any) => {
      if (entity === Account) return accountRepo.findOne(options);
      if (entity === Payment) return paymentRepo.findOne(options);
      if (entity === User) return Promise.resolve(null);
      return Promise.resolve(null);
    });
  });

  describe('create()', () => {
    const dto = {
      accountId: 'account-uuid-1',
      date: new Date('2025-01-15T10:00:00Z'),
      amount: 200,
    };

    it('should reject when account is not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto, adminActor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject with BadRequestException when account is FINISHED', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ status: AccountStatus.FINISHED }),
      );

      await expect(service.create(dto, adminActor)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should reject with BadRequestException when amount exceeds remaining balance', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ remainingBalance: 100 }),
      );

      await expect(service.create(dto, adminActor)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should wrap operations in a transaction with pessimistic_write lock on the account', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ remainingBalance: 1000 }),
      );

      await service.create(dto, adminActor);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(accountRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: dto.accountId },
          lock: { mode: 'pessimistic_write' },
        }),
      );
    });

    it('should attribute the payment to the actor (not to a DTO userId)', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({
          remainingBalance: 1000,
          customer: { id: 'c-1', zone: { id: 'zone-A' } } as any,
        }),
      );
      mockManager.findOne.mockImplementation((entity: any, options: any) => {
        if (entity === Account) return accountRepo.findOne(options);
        if (entity === Payment) return paymentRepo.findOne(options);
        if (entity === User) {
          return Promise.resolve({
            id: prestamistaActor.id,
            zones: [{ id: 'zone-A' }],
          });
        }
        return Promise.resolve(null);
      });

      await service.create(dto, prestamistaActor);

      const created = mockManager.create.mock.calls[0][1] as any;
      expect(created.userId).toBe(prestamistaActor.id);
    });

    it('should deduct amount and keep status ACTIVE when balance remains > 0', async () => {
      const account = buildAccount({ remainingBalance: 1000 });
      accountRepo.findOne.mockResolvedValue(account);

      await service.create(dto, adminActor);

      expect(account.remainingBalance).toBe(800);
      expect(account.status).toBe(AccountStatus.ACTIVE);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(accountService.invalidateCache).toHaveBeenCalledTimes(1);
    });

    it('should flip status to FINISHED when balance hits exactly 0', async () => {
      const account = buildAccount({ remainingBalance: 200 });
      accountRepo.findOne.mockResolvedValue(account);

      await service.create(dto, adminActor);

      expect(account.remainingBalance).toBe(0);
      expect(account.status).toBe(AccountStatus.FINISHED);
    });

    it('should NOT call invalidateCache if the transaction throws', async () => {
      accountRepo.findOne.mockRejectedValue(new Error('db down'));

      await expect(service.create(dto, adminActor)).rejects.toThrow('db down');
      expect(accountService.invalidateCache).not.toHaveBeenCalled();
    });

    it('should reject Prestamista when account customer zone is not in their zones', async () => {
      const manager = stubManager(['zone-A']);
      accountRepo.findOne.mockResolvedValue(
        buildAccount({
          customer: { id: 'c-1', zone: { id: 'zone-foreign' } } as any,
        }),
      );
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: any) => cb(manager),
      );

      await expect(service.create(dto, prestamistaActor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should allow Prestamista when account customer zone is in their zones', async () => {
      const manager = stubManager(['zone-A']);
      accountRepo.findOne.mockResolvedValue(
        buildAccount({
          customer: { id: 'c-1', zone: { id: 'zone-A' } } as any,
        }),
      );
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: any) => cb(manager),
      );

      await service.create(dto, prestamistaActor);

      expect(manager.save).toHaveBeenCalledTimes(2);
    });

    it('should allow Admin to skip zone-scope', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({
          customer: { id: 'c-1', zone: { id: 'zone-foreign' } } as any,
        }),
      );

      await service.create(dto, adminActor);

      expect(mockManager.save).toHaveBeenCalledTimes(2);
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
    it('findAll filters by accountId and returns payments for that account (admin)', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({ customer: { zone: { id: 'zone-A' } } as any }),
      );
      paymentRepo.find.mockResolvedValue([]);

      await service.findAll('account-uuid-1', adminActor);

      expect(paymentRepo.find).toHaveBeenCalledWith({
        where: { account: { id: 'account-uuid-1' } },
        relations: ['user'],
      });
    });

    it('findAll rejects Prestamista when account customer zone is not in their zones', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({
          customer: { zone: { id: 'zone-foreign' } } as any,
        }),
      );
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: any) => cb(stubManager(['zone-A'])),
      );

      await expect(
        service.findAll('account-uuid-1', prestamistaActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('findAll allows Prestamista when account customer zone is in their zones', async () => {
      accountRepo.findOne.mockResolvedValue(
        buildAccount({
          customer: { zone: { id: 'zone-A' } } as any,
        }),
      );
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: any) => cb(stubManager(['zone-A'])),
      );
      paymentRepo.find.mockResolvedValue([]);

      await service.findAll('account-uuid-1', prestamistaActor);

      expect(paymentRepo.find).toHaveBeenCalled();
    });

    it('findOne rejects Prestamista when payment account customer zone is not in their zones', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 'payment-uuid-1',
        account: { customer: { zone: { id: 'zone-foreign' } } },
      } as any);
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: any) => cb(stubManager(['zone-A'])),
      );

      await expect(
        service.findOne('payment-uuid-1', prestamistaActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('findOne rejects when payment does not exist', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nope', adminActor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
