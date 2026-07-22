import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { Role } from 'src/role/entities/role.entity';
import { Zone } from 'src/zone/entities/zone.entity';
import { Payment } from 'src/payment/entities/payment.entity';

describe('UserService.totalPaymentsToday()', () => {
  let service: UserService;
  let userRepo: jest.Mocked<any>;
  let paymentRepo: jest.Mocked<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Role),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Zone),
          useValue: { findOne: jest.fn(), findBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            // This test does not exercise transaction() — passthrough is fine.
            transaction: (cb: (manager: any) => unknown) =>
              cb({ getRepository: jest.fn() }),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    paymentRepo = module.get(getRepositoryToken(Payment));
  });

  it('should throw NotFoundException when user does not exist', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.totalPaymentsToday('nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should filter p.date against today in America/Lima (not UTC) and bind userId', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' } as any);

    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ zone: 'Norte', total: '500' }]),
    };
    paymentRepo.createQueryBuilder.mockReturnValue(qb);

    await service.totalPaymentsToday('user-1');

    const whereArgs = qb.where.mock.calls[0];
    expect(whereArgs[0]).toBe(
      "DATE(p.date AT TIME ZONE 'America/Lima') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date",
    );
    expect(whereArgs[0]).not.toBe('DATE(p.date) = CURRENT_DATE');
    expect(whereArgs[0]).toContain("'America/Lima'");

    const andWhereArgs = qb.andWhere.mock.calls[0];
    expect(andWhereArgs[0]).toBe('p.userId = :userId');
    expect(andWhereArgs[1]).toEqual({ userId: 'user-1' });
  });

  it('should never use raw CURRENT_DATE without a TIME ZONE cast (regression: cobranzas-after-7pm-Lima bug)', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' } as any);

    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    paymentRepo.createQueryBuilder.mockReturnValue(qb);

    await service.totalPaymentsToday('user-1');

    const whereArgs = qb.where.mock.calls[0];
    expect(whereArgs[0]).not.toMatch(/=\s*CURRENT_DATE\b/);
  });
});
