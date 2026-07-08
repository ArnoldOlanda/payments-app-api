import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

import { AuthService } from 'src/auth/auth.service';
import { UserService } from 'src/user/user.service';
import { RefreshToken } from 'src/auth/entities/refresh-token.entity';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const FUTURE = (offsetMs: number) => new Date(Date.now() + offsetMs);

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenRepo: any;
  let res: any;

  const buildUserMock = (overrides: Partial<any> = {}) => ({
    id: 'user-uuid-1',
    name: 'Cobrador Test',
    email: 'test@example.com',
    password: bcrypt.hashSync('correctPassword', 4),
    role: { name: 'Prestamista' },
    zones: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findBy: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('access-token-mock'),
            signAsync: jest.fn().mockResolvedValue('refresh-token-mock'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn(async (data) => ({ id: 'rt-uuid', ...data })),
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));

    res = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('validate()', () => {
    it('should throw UnauthorizedException when user is not found by email', async () => {
      userService.findBy.mockResolvedValue(null);

      await expect(
        service.validate(
          { email: 'missing@example.com', password: 'anything' } as any,
          res,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      userService.findBy.mockResolvedValue(buildUserMock() as any);

      await expect(
        service.validate(
          { email: 'test@example.com', password: 'wrongPassword' } as any,
          res,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    // Fix #1: response.user MUST NOT contain password
    it('should NOT expose password in the user returned to the client', async () => {
      const userMock = buildUserMock();
      userService.findBy.mockResolvedValue(userMock as any);

      await service.validate(
        { email: 'test@example.com', password: 'correctPassword' } as any,
        res,
      );

      expect(res.json).toHaveBeenCalledTimes(1);
      const payload = res.json.mock.calls[0][0];
      expect(payload.user).toBeDefined();
      expect(payload.user.email).toBe('test@example.com');
      expect(payload.user.password).toBeUndefined();
    });

    // Fix #2: login response MUST include refresh_token in body (mobile flow)
    it('should include refresh_token in the response body (dual-channel for mobile)', async () => {
      const userMock = buildUserMock();
      userService.findBy.mockResolvedValue(userMock as any);

      await service.validate(
        { email: 'test@example.com', password: 'correctPassword' } as any,
        res,
      );

      const payload = res.json.mock.calls[0][0];
      expect(payload.token).toBe('access-token-mock');
      expect(payload.refresh_token).toBe('refresh-token-mock');
    });

    it('should set refresh_token as an httpOnly cookie (web flow)', async () => {
      const userMock = buildUserMock();
      userService.findBy.mockResolvedValue(userMock as any);

      await service.validate(
        { email: 'test@example.com', password: 'correctPassword' } as any,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token-mock',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    // New: persist the refresh token row so it can be revoked later
    it('should persist the refresh token (hashed) in refresh_token table', async () => {
      userService.findBy.mockResolvedValue(buildUserMock() as any);

      await service.validate(
        { email: 'test@example.com', password: 'correctPassword' } as any,
        res,
      );

      expect(refreshTokenRepo.create).toHaveBeenCalledTimes(1);
      const created = refreshTokenRepo.create.mock.calls[0][0];
      expect(created.userId).toBe('user-uuid-1');
      expect(created.tokenHash).toBe(sha256('refresh-token-mock'));
      expect(created.revokedAt).toBeNull();
      expect(refreshTokenRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshToken()', () => {
    const validStored = (overrides: Partial<any> = {}) => ({
      id: 'rt-1',
      userId: 'user-uuid-1',
      tokenHash: sha256('valid-raw-token'),
      expiresAt: FUTURE(60_000),
      revokedAt: null,
      ...overrides,
    });

    it('should reject when no token is provided', async () => {
      await expect(service.refreshToken('')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject when token has no row in refresh_token table', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refreshToken('valid-raw-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should detect reuse, revoke all user tokens, and reject', async () => {
      const stored = validStored({ revokedAt: new Date(Date.now() - 1000) });
      refreshTokenRepo.findOne.mockResolvedValue(stored);

      await expect(
        service.refreshToken('valid-raw-token'),
      ).rejects.toThrow(/reuse detected/i);

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-uuid-1', revokedAt: expect.anything() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('should reject expired tokens', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(
        validStored({ expiresAt: new Date(Date.now() - 1) }),
      );

      await expect(
        service.refreshToken('valid-raw-token'),
      ).rejects.toThrow(/expired/i);
    });

    it('should reject when JWT payload id does not match the stored userId', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(validStored());
      jwtService.verifyAsync.mockResolvedValue({
        id: 'different-user-id',
        iat: 1,
        exp: 2,
      });

      await expect(
        service.refreshToken('valid-raw-token'),
      ).rejects.toThrow(/mismatch/i);
    });

    it('should revoke the consumed token, persist the new one, and return a fresh pair', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(validStored());
      jwtService.verifyAsync.mockResolvedValue({
        id: 'user-uuid-1',
        iat: 1,
        exp: 2,
      });
      jwtService.sign.mockReturnValue('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshToken('valid-raw-token');

      // 1st save revokes the old token row; 2nd save persists the new row
      expect(refreshTokenRepo.save).toHaveBeenCalledTimes(2);
      const revokedCall = refreshTokenRepo.save.mock.calls[0][0];
      expect(revokedCall.revokedAt).toBeInstanceOf(Date);
      const persistedCall = refreshTokenRepo.save.mock.calls[1][0];
      expect(persistedCall.userId).toBe('user-uuid-1');
      expect(persistedCall.tokenHash).toBe(sha256('new-refresh-token'));
      expect(persistedCall.revokedAt).toBeNull();

      // access token payload must NOT carry the refresh jti
      expect(jwtService.sign).toHaveBeenCalledWith({ id: 'user-uuid-1' });

      // refresh token payload MUST carry a unique jti
      const refreshPayload = jwtService.signAsync.mock.calls[0][0] as {
        id: string;
        jti: string;
      };
      expect(refreshPayload.id).toBe('user-uuid-1');
      expect(refreshPayload.jti).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      expect(result).toEqual({
        token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
    });

    it('should reject invalid JWT signatures', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(validStored());
      jwtService.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await expect(
        service.refreshToken('valid-raw-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout()', () => {
    it('should be a no-op when no token is provided', async () => {
      await service.logout(undefined);
      expect(refreshTokenRepo.save).not.toHaveBeenCalled();
    });

    it('should mark the matching token as revoked', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'u-1',
        tokenHash: sha256('raw'),
        expiresAt: FUTURE(60_000),
        revokedAt: null,
      });

      await service.logout('raw');

      const saved = refreshTokenRepo.save.mock.calls[0][0];
      expect(saved.revokedAt).toBeInstanceOf(Date);
    });

    it('should silently no-op when token row is not found', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.logout('unknown')).resolves.toBeUndefined();
      expect(refreshTokenRepo.save).not.toHaveBeenCalled();
    });

    it('should be idempotent on an already-revoked token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'u-1',
        tokenHash: sha256('raw'),
        expiresAt: FUTURE(60_000),
        revokedAt: new Date(Date.now() - 1000),
      });

      await expect(service.logout('raw')).resolves.toBeUndefined();
      expect(refreshTokenRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllForUser()', () => {
    it('should mark every active refresh token for the user as revoked', async () => {
      await service.revokeAllForUser('user-uuid-1');

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-uuid-1', revokedAt: expect.anything() },
        { revokedAt: expect.any(Date) },
      );
    });
  });
});
