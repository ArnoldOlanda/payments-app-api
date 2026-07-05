import { Inject, Injectable } from '@nestjs/common';
import { MAIL_GATEWAY, MailGateway } from './domain/mail-gateway';
import { renderPasswordReset } from './application/templates/render-password-reset';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_GATEWAY)
    private readonly gateway: MailGateway,
  ) {}

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const baseUrl =
      process.env.FRONTEND_RESET_URL || 'paymentsapp://reset-password';
    const ttlSeconds = Number(process.env.RESET_TOKEN_TTL_SECONDS) || 3600;
    const ttlMinutes = Math.floor(ttlSeconds / 60);
    const resetUrl = `${baseUrl}?token=${token}`;

    const { html, text } = await renderPasswordReset({
      resetUrl,
      ttlMinutes,
    });

    await this.gateway.send({
      to,
      subject: 'Restablecé tu contraseña',
      html,
      text,
    });
  }
}
