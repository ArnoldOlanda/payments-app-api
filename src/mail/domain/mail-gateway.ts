export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailGateway {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_GATEWAY = Symbol('MailGateway');
