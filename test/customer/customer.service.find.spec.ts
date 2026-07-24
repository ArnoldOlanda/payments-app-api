import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { CustomerService } from 'src/customer/customer.service';
import { Customer } from 'src/customer/entities/customer.entity';
import { Zone } from 'src/zone/entities/zone.entity';
import { AccountService } from 'src/account/account.service';
import { User } from 'src/user/entities/user.entity';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { Actor } from 'src/auth/types/actor.type';

describe('CustomerService find methods — zone scoping', () => {
  let service: CustomerService;
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
        return Promise.resolve(null);
      }),
    };
    return manager as EntityManager;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: getRepositoryToken(Customer),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((data) => data),
            save: jest.fn(async (data) => data),
            preload: jest.fn(),
            softDelete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Zone),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: AccountService,
          useValue: { remove: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { manager: {} as EntityManager },
        },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    customerRepo = module.get(getRepositoryToken(Customer));
    dataSource = module.get(DataSource);
  });

  describe('findAll()', () => {
    it('should inject zone filter for Prestamista', async () => {
      (dataSource.manager as any) = stubManager(['zone-A']);

      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'c-1' }], 1]),
      };
      customerRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 10 } as any, prestamistaActor);

      const andWhereCalls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(
        andWhereCalls.some((s: string) =>
          s.includes('zone.id IN (:...userZoneIds)'),
        ),
      ).toBe(true);
    });

    it('should NOT inject zone filter for Admin', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'c-1' }], 1]),
      };
      customerRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 10 } as any, adminActor);

      const andWhereCalls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(andWhereCalls.some((s: string) => s.includes('userZoneIds'))).toBe(
        false,
      );
    });

    it('should short-circuit to empty result for Prestamista with no zones assigned', async () => {
      (dataSource.manager as any) = stubManager([]);

      const result = (await service.findAll(
        { page: 1, limit: 10 } as any,
        prestamistaActor,
      )) as { data: unknown[]; total: number };

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(customerRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('should return the customer when Admin (no zone check)', async () => {
      const customer = { id: 'c-1', zone: { id: 'zone-X' } } as any;
      customerRepo.findOne.mockResolvedValue(customer);

      await expect(service.findOne('c-1', adminActor)).resolves.toBe(customer);
    });

    it('should return the customer when Prestamista owns the zone', async () => {
      const customer = { id: 'c-1', zone: { id: 'zone-A' } } as any;
      customerRepo.findOne.mockResolvedValue(customer);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await expect(service.findOne('c-1', prestamistaActor)).resolves.toBe(
        customer,
      );
    });

    it('should throw ForbiddenException for Prestamista when customer zone is foreign', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'c-1',
        zone: { id: 'zone-foreign' },
      } as any);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await expect(service.findOne('c-1', prestamistaActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for Prestamista when customer has no zone', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'c-1', zone: null } as any);

      await expect(service.findOne('c-1', prestamistaActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', adminActor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findCredits()', () => {
    it('should return accounts when Prestamista owns the zone', async () => {
      const accounts = [{ id: 'a-1' }];
      customerRepo.findOne.mockResolvedValue({
        id: 'c-1',
        zone: { id: 'zone-A' },
        accounts,
      } as any);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await expect(service.findCredits('c-1', prestamistaActor)).resolves.toBe(
        accounts,
      );
    });

    it('should throw ForbiddenException for Prestamista when customer zone is foreign', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'c-1',
        zone: { id: 'zone-foreign' },
        accounts: [],
      } as any);
      (dataSource.manager as any) = stubManager(['zone-A']);

      await expect(
        service.findCredits('c-1', prestamistaActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.findCredits('missing', adminActor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
