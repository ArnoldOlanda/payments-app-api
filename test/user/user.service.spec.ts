import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    const userRepoMock = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'user-1', ...data })),
      preload: jest.fn((data) => Promise.resolve(data)),
      softDelete: jest.fn(),
    };
    const zoneRepoMock = {
      findOne: jest.fn(),
      findBy: jest.fn(),
    };
    const dataSourceMock = {
      // Mimic the real transaction: invoke the callback with a manager that
      // hands out the same mocked repositories.
      transaction: jest.fn(async (cb: (manager: any) => unknown) =>
        cb({
          getRepository: (entity: any) =>
            entity === Zone ? zoneRepoMock : userRepoMock,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepoMock,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Zone),
          useValue: zoneRepoMock,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    zoneRepo = module.get(getRepositoryToken(Zone));
    dataSource = module.get(DataSource);
  });

  describe('update()', () => {
    it('should throw NotFoundException when ANY zone id is invalid', async () => {
      const validZoneId = 'zone-valid';
      const invalidZoneId = 'zone-bogus';

      zoneRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.id === validZoneId)
          return Promise.resolve({ id: validZoneId } as Zone);
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

      // Belt-and-suspenders: if a zone is invalid, the transaction must not
      // commit any save. Wrapping in dataSource.transaction rolls back on throw.
      expect(dataSource.transaction).toHaveBeenCalled();
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
        expect(data.zones).toHaveLength(3);
        return data;
      });
      zoneRepo.findOne.mockImplementation(({ where }: any) => {
        callOrder.push(`findOne:${where.id}`);
        return Promise.resolve({ id: where.id } as Zone);
      });

      await service.update('user-1', { zones: ids } as any);

      const firstPreloadIdx = callOrder.indexOf('preload');
      const lastFindOneIdx = callOrder
        .map((c, i) => (c.startsWith('findOne:') ? i : -1))
        .filter((i) => i >= 0)
        .pop();
      expect(lastFindOneIdx).toBeLessThan(firstPreloadIdx);
    });

    it('should clear zones when zones array is empty (explicit clear)', async () => {
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

    it('should keep current zones when zones field is omitted', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password: 'old-hash',
        role: { id: 'r', name: 'Admin' } as any,
      } as any);
      userRepo.preload.mockImplementation(async (data: any) => {
        // zones key must NOT be in the preload input — letting it through
        // with undefined would force TypeORM to clear the relation.
        expect(data).not.toHaveProperty('zones');
        return data;
      });

      await service.update('user-1', { name: 'New Name' } as any);

      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should hash a new password and leave the existing hash alone when empty', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password: 'old-hash',
        role: { id: 'r', name: 'Admin' } as any,
      } as any);
      userRepo.preload.mockImplementation(async (data: any) => data);

      // empty password → keep existing
      await service.update('user-1', { password: '' } as any);
      const emptyCall = userRepo.preload.mock.calls[0][0] as any;
      expect(emptyCall.password).toBeUndefined();

      // new password → bcrypt-hashed ($2 prefix for bcryptjs hashes)
      await service.update('user-1', { password: 'newpassword123' } as any);
      const filledCall = userRepo.preload.mock.calls[1][0] as any;
      expect(typeof filledCall.password).toBe('string');
      expect(filledCall.password).not.toBe('newpassword123');
      expect(filledCall.password.startsWith('$2')).toBe(true);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing-uuid', { name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getMe()', () => {
    it('should return the current user with role and zones populated', async () => {
      const actor = { id: 'user-1' };
      const expected = {
        id: 'user-1',
        name: 'Alice',
        role: { id: 'r1', name: 'Admin' },
        zones: [{ id: 'z1' }, { id: 'z2' }],
      };
      userRepo.findOne.mockResolvedValue(expected as any);

      const result = await service.getMe(actor);

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['role', 'zones'],
      });
      expect(result).toBe(expected);
    });

    it('should throw NotFoundException when the user no longer exists', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getMe({ id: 'gone' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
