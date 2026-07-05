import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CustomerService } from 'src/customer/customer.service';
import { Customer } from 'src/customer/entities/customer.entity';
import { Zone } from 'src/zone/entities/zone.entity';
import { AccountService } from 'src/account/account.service';

describe('CustomerService.update()', () => {
  let service: CustomerService;
  let customerRepo: jest.Mocked<any>;
  let zoneRepo: jest.Mocked<any>;
  let cacheStore: Map<string, any>;
  let cacheDelSpy: jest.Mock;

  beforeEach(async () => {
    cacheStore = new Map();
    cacheDelSpy = jest.fn(async (key: string) => {
      cacheStore.delete(key);
    });

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

    service = module.get<CustomerService>(CustomerService);
    customerRepo = module.get(getRepositoryToken(Customer));
    zoneRepo = module.get(getRepositoryToken(Zone));
  });

  it('should succeed when zoneId is NOT in the DTO (nullable field)', async () => {
    customerRepo.preload.mockResolvedValue({ id: 'c-1' } as any);

    await expect(
      service.update('c-1', { name: 'New Name' } as any),
    ).resolves.toBeTruthy();

    expect(zoneRepo.findOne).not.toHaveBeenCalled();
    expect(customerRepo.save).toHaveBeenCalled();
  });

  it('should validate the zone when zoneId IS provided', async () => {
    zoneRepo.findOne.mockResolvedValue({ id: 'zone-1' } as any);
    customerRepo.preload.mockResolvedValue({ id: 'c-1' } as any);

    await service.update('c-1', { zoneId: 'zone-1' } as any);

    expect(zoneRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'zone-1' },
    });
    expect(customerRepo.save).toHaveBeenCalled();
  });

  it('should throw NotFoundException when zoneId points to a non-existent zone', async () => {
    zoneRepo.findOne.mockResolvedValue(null);

    await expect(
      service.update('c-1', { zoneId: 'zone-bogus' } as any),
    ).rejects.toThrow(NotFoundException);

    expect(customerRepo.save).not.toHaveBeenCalled();
  });

  it('should accept explicit null zoneId to clear the zone without lookup', async () => {
    customerRepo.preload.mockResolvedValue({ id: 'c-1' } as any);

    await service.update('c-1', { zoneId: null } as any);

    expect(zoneRepo.findOne).not.toHaveBeenCalled();
    expect(customerRepo.save).toHaveBeenCalled();
  });
});
