import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import type { Env } from '@api/config/env.schema';

export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  /** Referenced from the HTML as `cid:<contentId>`, so the image travels with the message. */
  readonly contentId: string;
}

export interface OutboundEmail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  /** What a client with images turned off, or a screen reader, reads instead. */
  readonly text: string;
  readonly attachments?: readonly EmailAttachment[] | undefined;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutboundEmail): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

/**
 * Not a stub: it is the correct provider wherever there is no mail account, and it prints the link
 * — so activation and reset work end to end on a laptop with no API key at all.
 */
@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';

  private readonly logger = new Logger('Email');

  send(email: OutboundEmail): Promise<void> {
    this.logger.log(`→ ${email.to}: ${email.subject}\n${email.text}`);

    return Promise.resolve();
  }
}

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  private readonly resend: Resend;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    // Checked at construction rather than at send: a deployment that selected this provider without
    // a key should fail to boot, not fail the first time somebody is invited.
    const key = config.get('RESEND_API_KEY', { infer: true });

    if (!key) {
      throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY');
    }

    this.resend = new Resend(key);
    this.from = config.get('EMAIL_FROM', { infer: true });
  }

  async send(email: OutboundEmail): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.attachments?.length
        ? {
            attachments: email.attachments.map((file) => ({
              filename: file.filename,
              content: file.content.toString('base64'),
              contentId: file.contentId,
            })),
          }
        : {}),
    });

    // Resend answers with an error object rather than throwing, so a failure would otherwise look
    // exactly like a delivery.
    if (error) {
      throw new Error(`Resend refused the message: ${error.message}`);
    }
  }
}
