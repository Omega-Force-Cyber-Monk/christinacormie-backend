import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type SendMailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly smtpHost = process.env.SMTP_HOST;
  private readonly smtpPort = Number(process.env.SMTP_PORT || 587);
  private readonly smtpSecure = process.env.SMTP_SECURE === 'true';
  private readonly smtpUser = process.env.SMTP_USER;
  private readonly smtpPass = process.env.SMTP_PASS;
  private readonly fromEmail =
    process.env.MAIL_FROM_EMAIL || 'noreply@bitedropapp.com';
  private readonly fromName = process.env.MAIL_FROM_NAME || 'BiteDrop';

  constructor() {
    if (this.smtpHost && this.smtpUser && this.smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });
    }
  }

  async send(options: SendMailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP mailer is not configured. Skipping email to ${this.stringifyRecipients(options.to)} with subject "${options.subject}".`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        ...(options.html ? { html: options.html } : {}),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown SMTP transport error';
      this.logger.error(`Failed to send email: ${message}`);
      throw error;
    }
  }

  private stringifyRecipients(to: string | string[]) {
    return Array.isArray(to) ? to.join(', ') : to;
  }
}
