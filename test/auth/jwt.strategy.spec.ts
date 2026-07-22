import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { User } from 'src/user/entities/user.entity';

describe('JwtStrategy.validate()', () => {
  let strategy: JwtStrategy;
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns an actor that includes the timezone claim from the JWT payload', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      timezone: 'Europe/Madrid',
      role: { name: 'Admin' },
    });

    const actor = await strategy.validate({
      id: 'user-1',
      timezone: 'Europe/Madrid',
    });

    expect(actor.id).toBe('user-1');
    expect(actor.role).toBe('Admin');
    expect((actor as { timezone?: string }).timezone).toBe('Europe/Madrid');
  });

  it('falls back to the user row timezone when the JWT payload has none', async () => {
    // Backwards compat: tokens issued before the timezone feature don't carry
    // the claim. The user row is the source of truth at validate time.
    userRepo.findOne.mockResolvedValue({
      id: 'user-2',
      email: 'c@d.com',
      timezone: 'Asia/Tokyo',
      role: { name: 'Prestamista' },
    });

    const actor = await strategy.validate({ id: 'user-2' });

    expect((actor as { timezone?: string }).timezone).toBe('Asia/Tokyo');
  });

  it('throws UnauthorizedException when the user row does not exist', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(strategy.validate({ id: 'ghost' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
