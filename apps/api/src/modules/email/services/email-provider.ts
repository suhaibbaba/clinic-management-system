import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Env } from "@api/config/env.schema";
import { EmailProvider, OutboundEmail } from "@api/modules/email/lib/email-provider";
import { resendSender } from "@api/modules/email/lib/resend-sender";

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

  private readonly sender: EmailProvider;

  constructor(config: ConfigService<Env, true>) {
    const key = config.get("RESEND_API_KEY", { infer: true });

    if (!key) {
      throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
    }

    this.sender = resendSender(key, config.get("EMAIL_FROM", { infer: true }));
  }

  send(email: OutboundEmail): Promise<void> {
    return this.sender.send(email);
  }
}
