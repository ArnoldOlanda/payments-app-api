import { Inject, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { MailGateway, MailMessage } from '../domain/mail-gateway';

export const RESEND_CLIENT = Symbol('ResendClient');
export const MAIL_FROM = Symbol('MailFrom');

@Injectable()
export class ResendMailGateway implements MailGateway {
  private readonly logger = new Logger(ResendMailGateway.name);

  constructor(
    @Inject(RESEND_CLIENT)
    private readonly client: Resend,
    @Inject(MAIL_FROM)
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (error) {
      this.logger.error(
        `Resend send failed for ${message.to}: ${error.message}`,
      );
      throw new Error(error.message);
    }
  }
}
