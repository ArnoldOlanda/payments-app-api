import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { Role } from 'src/role/entities/role.entity';
import { Zone } from 'src/zone/entities/zone.entity';
import { Payment } from 'src/payment/entities/payment.entity';

describe('UserService', () => {
  let service: UserService;
  let userRepo: jest.Mocked<Repository<User>>;
  let zoneRepo: jest.Mocked<Repository<Zone>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((data) => data),
            save: jest.fn((data) => Promise.resolve({ id: 'user-1', ...data })),
            preload: jest.fn((data) => Promise.resolve(data)),
            softDelete: jest.fn(),
          },
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
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    zoneRepo = module.get(getRepositoryToken(Zone));
  });

  describe('update()', () => {
    // Fix #3: with the race condition, forEach(async) doesn't await and
    // preload runs with an empty userZones array even when a zone is invalid.
    // The correct behavior is: ALL zones must be validated before any save.

    it('should throw NotFoundException when ANY zone id is invalid (no race)', async () => {
      const validZoneId = 'zone-valid';
      const invalidZoneId = 'zone-bogus';

      zoneRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.id === validZoneId)
          return Promise.resolve({ id: validZoneId } as Zone);
        if (where.id === invalidZoneId) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password: 'old-hash',
        role: { id: 'r', name: 'Admin' } as any,
      } as any);

      await expect(
        service.update('user-1', {
          zones: [validZoneId, invalidZoneId],
        } as any),
      ).rejects.toThrow(NotFoundException);

      // Belt-and-suspenders: preload must not have run with empty zones.
      // If the bug is present, preload completes successfully and save
      // is called with no zones (silently clearing them).
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should resolve ALL valid zones before invoking preload', async () => {
      const ids = ['zone-1', 'zone-2', 'zone-3'];

      zoneRepo.findOne.mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where.id } as Zone),
      );

      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password: 'old-hash',
        role: { id: 'r', name: 'Admin' } as any,
      } as any);

      const callOrder: string[] = [];
      userRepo.preload.mockImplementation(async (data: any) => {
        callOrder.push('preload');
        // Assert ALL three zones are present when preload runs
        expect(data.zones).toHaveLength(3);
        return data;
      });
      zoneRepo.findOne.mockImplementation(({ where }: any) => {
        callOrder.push(`findOne:${where.id}`);
        return Promise.resolve({ id: where.id } as Zone);
      });

      await service.update('user-1', { zones: ids } as any);

      // All findOne calls must happen BEFORE preload
      const firstPreloadIdx = callOrder.indexOf('preload');
      const lastFindOneIdx = callOrder
        .map((c, i) => (c.startsWith('findOne:') ? i : -1))
        .filter((i) => i >= 0)
        .pop();
      expect(lastFindOneIdx).toBeLessThan(firstPreloadIdx);
    });

    it('should clear zones when zones array is empty (document current contract)', async () => {
      zoneRepo.findOne.mockResolvedValue({ id: 'zone-x' } as Zone);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password: 'old-hash',
        role: { id: 'r', name: 'Admin' } as any,
      } as any);
      userRepo.preload.mockImplementation(async (data: any) => {
        expect(data.zones).toEqual([]);
        return data;
      });

      await service.update('user-1', { zones: [] } as any);

      expect(userRepo.preload).toHaveBeenCalledWith(
        expect.objectContaining({ zones: [] }),
      );
      expect(userRepo.save).toHaveBeenCalled();
    });
  });
});
