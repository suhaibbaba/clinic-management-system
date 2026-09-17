import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

import type { Env } from "@api/config/env.schema";

export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  /** Referenced from the HTML as `cid:<contentId>`, so the image travels with the message. */
  readonly contentId: string;
}

export interface OutboundEmail {
  readonly to: string;
  /** Shown instead of the configured one. The address is not the clinic's to choose — see below. */
  readonly fromName?: string | undefined;
  /** Where a reply goes. Needs no verification at all, which is why this is the clinic's own. */
  readonly replyTo?: string | undefined;
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

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = "log";

  private readonly logger = new Logger("Email");

  send(email: OutboundEmail): Promise<void> {
    this.logger.log(`→ ${email.to}: ${email.subject}\n${email.text}`);

    return Promise.resolve();
  }
}

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  private readonly resend: Resend;
  private readonly from: string;
  /** The bare address out of `EMAIL_FROM`, so a display name can be put in front of it. */
  private readonly fromAddress: string;

  constructor(config: ConfigService<Env, true>) {
    const key = config.get("RESEND_API_KEY", { infer: true });

    if (!key) {
      throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
    }

    this.resend = new Resend(key);
    this.from = config.get("EMAIL_FROM", { infer: true });
    this.fromAddress = this.from.match(/<([^>]+)>/)?.[1] ?? this.from;
  }

  async send(email: OutboundEmail): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: email.fromName ? `${email.fromName} <${this.fromAddress}>` : this.from,
      to: [email.to],
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.attachments?.length
        ? {
            attachments: email.attachments.map((file) => ({
              filename: file.filename,
              content: file.content.toString("base64"),
              contentId: file.contentId,
            })),
          }
        : {}),
    });

    if (error) {
      throw new Error(`Resend refused the message: ${error.message}`);
    }
  }
}
