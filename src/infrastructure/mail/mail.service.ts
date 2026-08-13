import { Injectable, Logger } from '@nestjs/common';

type SendMailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly fromEmail =
    process.env.MAIL_FROM_EMAIL || 'noreply@bitedropapp.com';

  async send(options: SendMailOptions): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY is not set. Skipping email to ${this.stringifyRecipients(options.to)} with subject "${options.subject}".`,
      );
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          text: options.text,
          ...(options.html ? { html: options.html } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(
          `Failed to send email (${response.status}): ${body || 'No response body'}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown email transport error';
      this.logger.error(`Failed to send email: ${message}`);
    }
  }

  private stringifyRecipients(to: string | string[]) {
    return Array.isArray(to) ? to.join(', ') : to;
  }
}
