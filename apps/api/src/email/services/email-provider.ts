import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { type Env } from "@api/config/env.schema";
import { EmailProvider, OutboundEmail } from "@api/email/lib/email-provider";

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
