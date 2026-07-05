import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from 'src/mail/mail.service';
import { MAIL_GATEWAY, MailGateway, MailMessage } from 'src/mail/domain/mail-gateway';
import { PasswordResetClient } from 'src/auth/dto/forgot-password.dto';

jest.mock(
  '../../src/mail/application/templates/render-password-reset',
  () => ({
  renderPasswordReset: jest.fn(async (data: any) => ({
    html: `<p>rendered: ${data.resetUrl}</p>`,
    text: `rendered text ${data.resetUrl}`,
  })),
}));

describe('MailService', () => {
  let service: MailService;
  let gateway: jest.Mocked<MailGateway>;
  const originalWebUrl = process.env.FRONTEND_WEB_URL;
  const originalResetUrl = process.env.FRONTEND_RESET_URL;
  const originalTtl = process.env.RESET_TOKEN_TTL_SECONDS;

  beforeEach(async () => {
    process.env.FRONTEND_WEB_URL = 'https://admin.paymentsapp.com/reset-password';
    process.env.FRONTEND_RESET_URL = 'paymentsapp://reset-password';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MAIL_GATEWAY,
          useValue: {
            send: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    gateway = module.get<MailGateway>(MAIL_GATEWAY) as jest.Mocked<MailGateway>;
  });

  afterEach(() => {
    if (originalWebUrl === undefined) {
      delete process.env.FRONTEND_WEB_URL;
    } else {
      process.env.FRONTEND_WEB_URL = originalWebUrl;
    }
    if (originalResetUrl === undefined) {
      delete process.env.FRONTEND_RESET_URL;
    } else {
      process.env.FRONTEND_RESET_URL = originalResetUrl;
    }
    if (originalTtl === undefined) {
      delete process.env.RESET_TOKEN_TTL_SECONDS;
    } else {
      process.env.RESET_TOKEN_TTL_SECONDS = originalTtl;
    }
    jest.clearAllMocks();
  });

  describe('sendPasswordResetEmail()', () => {
    it('should build a WEB URL when client is "web"', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'raw-token-abc',
        PasswordResetClient.Web,
      );

      expect(gateway.send).toHaveBeenCalledTimes(1);
      const call = gateway.send.mock.calls[0][0] as MailMessage;

      expect(call.to).toBe('user@example.com');
      expect(call.subject).toBe('Restablecé tu contraseña');
      expect(typeof call.html).toBe('string');
      expect(call.html.length).toBeGreaterThan(0);
      expect(call.html).toContain(
        'https://admin.paymentsapp.com/reset-password?token=raw-token-abc',
      );
      expect(call.text).toBeDefined();
      expect(call.text).toContain(
        'https://admin.paymentsapp.com/reset-password?token=raw-token-abc',
      );
    });

    it('should build a DEEP LINK URL when client is "mobile"', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'raw-token-abc',
        PasswordResetClient.Mobile,
      );

      const call = gateway.send.mock.calls[0][0] as MailMessage;
      expect(call.html).toContain(
        'paymentsapp://reset-password?token=raw-token-abc',
      );
      expect(call.text).toContain(
        'paymentsapp://reset-password?token=raw-token-abc',
      );
    });

    it('should normalize a trailing slash in FRONTEND_WEB_URL for web clients', async () => {
      process.env.FRONTEND_WEB_URL = 'https://admin.paymentsapp.com/reset-password/';

      await service.sendPasswordResetEmail(
        'user@example.com',
        'tok',
        PasswordResetClient.Web,
      );

      const call = gateway.send.mock.calls[0][0] as MailMessage;
      expect(call.html).toContain(
        'https://admin.paymentsapp.com/reset-password?token=tok',
      );
    });

    it('should normalize a trailing slash in FRONTEND_RESET_URL for mobile clients', async () => {
      process.env.FRONTEND_RESET_URL = 'paymentsapp://reset-password/';

      await service.sendPasswordResetEmail(
        'user@example.com',
        'tok',
        PasswordResetClient.Mobile,
      );

      const call = gateway.send.mock.calls[0][0] as MailMessage;
      expect(call.html).toContain('paymentsapp://reset-password?token=tok');
    });

    it('should pass the TTL in minutes (1800s -> 30 min) via template data', async () => {
      process.env.RESET_TOKEN_TTL_SECONDS = '1800';

      await service.sendPasswordResetEmail(
        'user@example.com',
        'tok',
        PasswordResetClient.Web,
      );

      const call = gateway.send.mock.calls[0][0] as MailMessage;
      expect(call.html).toContain(
        'https://admin.paymentsapp.com/reset-password?token=tok',
      );
    });

    it('should default to 60 minutes when RESET_TOKEN_TTL_SECONDS is not set', async () => {
      delete process.env.RESET_TOKEN_TTL_SECONDS;

      await service.sendPasswordResetEmail(
        'user@example.com',
        'tok',
        PasswordResetClient.Web,
      );

      const call = gateway.send.mock.calls[0][0] as MailMessage;
      expect(call.html).toContain(
        'https://admin.paymentsapp.com/reset-password?token=tok',
      );
    });
  });
});
