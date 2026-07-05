import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { PasswordResetService } from 'src/auth/services/password-reset.service';

describe('AuthController (e2e-style, mocked services)', () => {
  let app: any;
  let authService: jest.Mocked<AuthService>;
  let passwordResetService: jest.Mocked<PasswordResetService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            validate: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PasswordResetService,
          useValue: {
            requestReset: jest.fn().mockResolvedValue(undefined),
            resetPassword: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    passwordResetService = moduleRef.get(PasswordResetService);
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ---------- forgot-password ----------

  describe('POST /auth/forgot-password', () => {
    it('should return 200 and call service.requestReset with the email', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(200)
        .expect({ message: 'If the email exists, a reset link has been sent' });

      expect(passwordResetService.requestReset).toHaveBeenCalledWith(
        'user@example.com',
      );
    });

    it('should always return 200 even when user does not exist (no leak)', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'ghost@example.com' })
        .expect(200);

      expect(passwordResetService.requestReset).toHaveBeenCalledWith(
        'ghost@example.com',
      );
    });

    it('should return 400 when email is missing (ValidationPipe)', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({})
        .expect(400);

      expect(passwordResetService.requestReset).not.toHaveBeenCalled();
    });

    it('should return 400 when email is malformed', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(passwordResetService.requestReset).not.toHaveBeenCalled();
    });
  });

  // ---------- reset-password ----------

  describe('POST /auth/reset-password', () => {
    it('should return 200 and call service.resetPassword with token + new password', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'tok-abc', new_password: 'newPass123' })
        .expect(200)
        .expect({ message: 'Password has been reset successfully' });

      expect(passwordResetService.resetPassword).toHaveBeenCalledWith(
        'tok-abc',
        'newPass123',
      );
    });

    it('should return 400 when token is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ new_password: 'newPass123' })
        .expect(400);

      expect(passwordResetService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return 400 when new_password is shorter than 8 chars', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'tok-abc', new_password: 'short' })
        .expect(400);

      expect(passwordResetService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return 400 when service throws BadRequest (invalid/expired token)', async () => {
      passwordResetService.resetPassword.mockRejectedValueOnce(
        new BadRequestException('Invalid or expired token'),
      );

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'bogus', new_password: 'newPass123' })
        .expect(400);
    });
  });

  // ---------- refresh-token (dual-channel: cookie OR body) ----------

  describe('POST /auth/refresh-token', () => {
    it('should return 400 when neither cookie nor body contains refresh_token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({})
        .expect(400);

      expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('should call authService.refreshToken when body has refresh_token (mobile flow)', async () => {
      authService.refreshToken.mockResolvedValue({
        token: 'new-access',
        refresh_token: 'new-refresh',
      });

      await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refresh_token: 'raw-token-from-mobile' })
        .expect(200);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        'raw-token-from-mobile',
      );
    });

    it('should call authService.refreshToken when cookie has refresh_token (web flow)', async () => {
      authService.refreshToken.mockResolvedValue({
        token: 'new-access',
        refresh_token: 'new-refresh',
      });

      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/refresh-token')
        .set('Cookie', 'refresh_token=cookie-token-from-web')
        .send({})
        .expect(200);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        'cookie-token-from-web',
      );
    });
  });

  // ---------- logout ----------

  describe('POST /auth/logout', () => {
    it('should call authService.logout with the body refresh_token (mobile flow)', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refresh_token: 'mobile-refresh-token' })
        .expect(200)
        .expect({ message: 'Logged out' });

      expect(authService.logout).toHaveBeenCalledWith('mobile-refresh-token');
    });

    it('should call authService.logout with the cookie refresh_token (web flow)', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/logout')
        .set('Cookie', 'refresh_token=web-cookie-token')
        .send({})
        .expect(200);

      expect(authService.logout).toHaveBeenCalledWith('web-cookie-token');
    });

    it('should still return 200 even when no refresh token is presented', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({})
        .expect(200);

      expect(authService.logout).toHaveBeenCalledWith(undefined);
    });
  });
});
