import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from 'src/mail/mail.service';
import {
  MAIL_GATEWAY,
  MailGateway,
  MailMessage,
} from 'src/mail/domain/mail-gateway';

describe('MailService', () => {
  let service: MailService;
  let gateway: jest.Mocked<MailGateway>;
  const originalResetUrl = process.env.FRONTEND_RESET_URL;
  const originalTtl = process.env.RESET_TOKEN_TTL_SECONDS;

  beforeEach(async () => {
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
  });

  describe('sendPasswordResetEmail()', () => {
    it('should call the gateway with the rendered email and the deep link', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'raw-token-abc');

      expect(gateway.send).toHaveBeenCalledTimes(1);
      const call = gateway.send.mock.calls[0][0] as MailMessage;

      expect(call.to).toBe('user@example.com');
      expect(call.subject).toBe('Restablecé tu contraseña');
      expect(typeof call.html).toBe('string');
      expect(call.html.length).toBeGreaterThan(0);
      expect(call.html).toContain(
        'paymentsapp://reset-password?token=raw-token-abc',
      );
      expect(call.html).toContain('Restablecer contraseña');
      expect(call.text).toBeDefined();
      expect(call.text).toContain(
        'paymentsapp://reset-password?token=raw-token-abc',
      );
    });

    it('should pass the TTL in minutes (1800s -> 30 min)', async () => {
      process.env.RESET_TOKEN_TTL_SECONDS = '1800';

      await service.sendPasswordResetEmail('user@example.com', 'tok');

      const call = gateway.send.mock.calls[0][0] as MailMessage;
      expect(call.html).toContain('30 minutos');
      expect(call.text).toContain('30 minutos');
    });

    it('should default to 60 minutes when RESET_TOKEN_TTL_SECONDS is not set', async () => {
      delete process.env.RESET_TOKEN_TTL_SECONDS;

      await service.sendPasswordResetEmail('user@example.com', 'tok');

      const call = gateway.send.mock.calls[0][0] as MailMessage;
      expect(call.html).toContain('60 minutos');
      expect(call.text).toContain('60 minutos');
    });
  });
});
