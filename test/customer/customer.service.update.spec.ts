import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CustomerService } from 'src/customer/customer.service';
import { Customer } from 'src/customer/entities/customer.entity';
import { Zone } from 'src/zone/entities/zone.entity';
import { AccountService } from 'src/account/account.service';

describe('CustomerService.update()', () => {
  let service: CustomerService;
  let customerRepo: jest.Mocked<any>;
  let zoneRepo: jest.Mocked<any>;

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
          useValue: {
            manager: {},
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
    customerRepo.preload.mockResolvedValue({ id: 'c-1' } as any);
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

  it('should attach the resolved Zone to the entity before saving (regression: zoneId was silently dropped by preload)', async () => {
    const zone = { id: 'zone-1', name: 'Zone One' };
    const preloaded = { id: 'c-1' } as any;
    customerRepo.preload.mockResolvedValue(preloaded);
    zoneRepo.findOne.mockResolvedValue(zone);

    await service.update('c-1', { zoneId: 'zone-1' } as any);

    expect(customerRepo.save).toHaveBeenCalledTimes(1);
    const savedEntity = customerRepo.save.mock.calls[0][0];
    expect(savedEntity.zone).toBe(zone);
    expect(savedEntity.zoneId).toBeUndefined();
  });

  it('should set customer.zone to null when zoneId is explicitly null', async () => {
    const preloaded = { id: 'c-1', zone: { id: 'zone-old' } } as any;
    customerRepo.preload.mockResolvedValue(preloaded);

    await service.update('c-1', { zoneId: null } as any);

    expect(customerRepo.save).toHaveBeenCalledTimes(1);
    const savedEntity = customerRepo.save.mock.calls[0][0];
    expect(savedEntity.zone).toBeNull();
  });

  it('should throw NotFoundException when customer does not exist (even with valid zoneId)', async () => {
    customerRepo.preload.mockResolvedValue(null);
    zoneRepo.findOne.mockResolvedValue({ id: 'zone-1' } as any);

    await expect(
      service.update('c-missing', { zoneId: 'zone-1' } as any),
    ).rejects.toThrow(NotFoundException);

    expect(zoneRepo.findOne).not.toHaveBeenCalled();
    expect(customerRepo.save).not.toHaveBeenCalled();
  });
});
