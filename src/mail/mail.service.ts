import { Inject, Injectable } from '@nestjs/common';
import { MAIL_GATEWAY, MailGateway } from './domain/mail-gateway';
import { renderPasswordReset } from './application/templates/render-password-reset';
import { PasswordResetClient } from 'src/auth/dto/forgot-password.dto';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_GATEWAY)
    private readonly gateway: MailGateway,
  ) {}

  async sendPasswordResetEmail(
    to: string,
    token: string,
    client: PasswordResetClient,
  ): Promise<void> {
    const baseUrl =
      client === PasswordResetClient.Mobile
        ? process.env.FRONTEND_RESET_URL || 'paymentsapp://reset-password'
        : process.env.FRONTEND_WEB_URL || 'http://localhost:3000/reset-password';

    const ttlSeconds = Number(process.env.RESET_TOKEN_TTL_SECONDS) || 3600;
    const ttlMinutes = Math.floor(ttlSeconds / 60);
    const resetUrl = `${baseUrl.replace(/\/$/, '')}?token=${token}`;

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
