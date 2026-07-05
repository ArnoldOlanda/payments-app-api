import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from 'src/auth/auth.service';
import { UserService } from 'src/user/user.service';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);

    res = {
      cookie: jest.fn().mockReturnThis(),
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
          maxAge: 1000 * 60 * 60 * 24 * 7,
        }),
      );
    });
  });

  describe('refreshToken()', () => {
    it('should verify the refresh token and return a new access token + new refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        id: 'user-uuid-1',
        iat: 1,
        exp: 2,
      });
      // 1st signAsync call → new access token; 2nd → new refresh token
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshToken('valid-refresh-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-refresh-token',
        expect.objectContaining({ secret: process.env.REFRESH_TOKEN_SECRET }),
      );
      expect(result).toEqual({
        token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException when the refresh token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

      await expect(service.refreshToken('bogus')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
