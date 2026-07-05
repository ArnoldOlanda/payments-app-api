import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import { MailService } from './mail.service';
import { MAIL_GATEWAY } from './domain/mail-gateway';
import {
  MAIL_FROM,
  RESEND_CLIENT,
  ResendMailGateway,
} from './infrastructure/resend-mail.gateway';

@Module({
  providers: [
    {
      provide: RESEND_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        new Resend(cfg.getOrThrow<string>('RESEND_API_KEY')),
    },
    {
      provide: MAIL_FROM,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => cfg.getOrThrow<string>('MAIL_FROM'),
    },
    ResendMailGateway,
    {
      provide: MAIL_GATEWAY,
      useExisting: ResendMailGateway,
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
