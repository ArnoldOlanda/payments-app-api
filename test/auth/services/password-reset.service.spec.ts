import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import { PasswordResetService } from 'src/auth/services/password-reset.service';
import { PasswordResetClient } from 'src/auth/dto/forgot-password.dto';
import { PasswordResetToken } from 'src/auth/entities/password-reset-token.entity';
import { User } from 'src/user/entities/user.entity';
import { MailService } from 'src/mail/mail.service';
import { AuthService } from 'src/auth/auth.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let tokenRepo: jest.Mocked<Repository<PasswordResetToken>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let mailService: jest.Mocked<MailService>;
  let authService: jest.Mocked<Pick<AuthService, 'revokeAllForUser'>>;

  const hashToken = (token: string) =>
    crypto.createHash('sha256').update(token).digest('hex');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn((data) =>
              Promise.resolve({ id: 'token-uuid', ...data }),
            ),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn((data) => Promise.resolve(data)),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuthService,
          useValue: {
            revokeAllForUser: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    tokenRepo = module.get(getRepositoryToken(PasswordResetToken));
    userRepo = module.get(getRepositoryToken(User));
    mailService = module.get(MailService);
    authService = module.get(AuthService) as any;
  });

  describe('requestReset()', () => {
    it('should create a token and send the email when user exists', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      } as any);

      await service.requestReset('user@example.com', PasswordResetClient.Web);

      expect(tokenRepo.create).toHaveBeenCalledTimes(1);
      expect(tokenRepo.save).toHaveBeenCalledTimes(1);
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      const [to, tokenArg, clientArg] =
        mailService.sendPasswordResetEmail.mock.calls[0];
      expect(to).toBe('user@example.com');
      expect(typeof tokenArg).toBe('string');
      expect(tokenArg.length).toBeGreaterThanOrEqual(32); // base64url(32 bytes) ≈ 43 chars
      expect(clientArg).toBe(PasswordResetClient.Web);
    });

    it('should hash the token with sha256 before persisting', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'x@y.com',
      } as any);

      await service.requestReset('x@y.com', PasswordResetClient.Mobile);

      const saved = tokenRepo.save.mock.calls[0][0] as any;
      expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
    });

    it('should NOT throw, NOT create a token, NOT send email when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.requestReset('ghost@example.com', PasswordResetClient.Web),
      ).resolves.toBeUndefined();

      expect(tokenRepo.create).not.toHaveBeenCalled();
      expect(tokenRepo.save).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should still call findOne (to keep response time constant) when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await service.requestReset('ghost@example.com', PasswordResetClient.Web);

      expect(userRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword()', () => {
    const rawToken = 'raw-token-xyz';
    const tokenHash = hashToken(rawToken);

    it('should update password and mark token used when token is valid and unused and unexpired', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      tokenRepo.findOne.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: future,
        usedAt: null,
      } as any);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password: 'old-hash',
      } as any);

      await service.resetPassword(rawToken, 'newPass123');

      expect(userRepo.save).toHaveBeenCalledTimes(1);
      const savedUser = userRepo.save.mock.calls[0][0] as any;
      expect(savedUser.id).toBe('user-1');
      // bcrypt hash, not the plain password
      expect(savedUser.password).not.toBe('newPass123');
      expect(bcrypt.compareSync('newPass123', savedUser.password)).toBe(true);

      expect(tokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
    });

    it('should throw BadRequestException when token is not found / invalid / used / expired', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('any-token', 'newPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not update the user password when token is invalid', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      try {
        await service.resetPassword('bogus', 'newPass123');
      } catch {
        // expected
      }

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should revoke all refresh tokens for the user after a successful reset', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      tokenRepo.findOne.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: future,
        usedAt: null,
      } as any);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password: 'old-hash',
      } as any);

      await service.resetPassword(rawToken, 'newPass123');

      expect(authService.revokeAllForUser).toHaveBeenCalledTimes(1);
      expect(authService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('should not revoke refresh tokens when the reset fails', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      try {
        await service.resetPassword('bogus', 'newPass123');
      } catch {
        // expected
      }

      expect(authService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});
