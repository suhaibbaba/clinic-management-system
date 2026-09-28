import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { personName } from "@clinic/shared";
import { type Env } from "@api/config/env.schema";
import { EMAIL_PROVIDER, COPY, LOGO_CONTENT_ID } from "@api/modules/email/constants";
import { type EmailProvider } from "@api/modules/email/lib/email-provider";
import { renderEmail } from "@api/modules/email/lib/email-template";
import { StorageService } from "@api/modules/storage/services/storage.service";
import {
  IssuedToken,
  hashToken,
  AccountEmailPurpose,
  AccountEmailRecipient,
  ClinicLetterhead,
} from "@api/modules/email/lib/account-email";

@Injectable()
export class AccountEmailService {
  private readonly logger = new Logger("AccountEmail");

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly config: ConfigService<Env, true>,
    private readonly storage: StorageService,
  ) {}

  issueToken(): IssuedToken {
    const token = randomBytes(32).toString("base64url");
    const hours = this.config.get("EMAIL_LINK_TTL_HOURS", { infer: true });

    return {
      token,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    };
  }

  async send(
    purpose: AccountEmailPurpose,
    recipient: AccountEmailRecipient,
    clinic: ClinicLetterhead,
    token: string,
  ): Promise<void> {
    const base = this.config.get("PUBLIC_BASE_URL", { infer: true }).replace(/\/$/, "");
    const hours = this.config.get("EMAIL_LINK_TTL_HOURS", { infer: true });
    const copy = COPY[purpose];
    const clinicName = personName(clinic.name, "ar");
    const who = personName(recipient.name, "ar");
    const logo = await this.logo(clinic.logoKey);

    const { html, text } = renderEmail({
      clinicName,
      ...(logo ? { logoContentId: LOGO_CONTENT_ID } : {}),
      heading: copy.heading,
      body: copy.body(who, clinicName, hours),
      action: { label: copy.action, url: `${base}/${purpose}/${token}` },
      footer: copy.footer,
    });

    await this.provider.send({
      to: recipient.email,
      fromName: clinicName,
      ...(clinic.email ? { replyTo: clinic.email } : {}),
      subject: copy.subject(clinicName),
      html,
      text,
      ...(logo ? { attachments: [logo] } : {}),
    });
  }

  private async logo(
    key: string | null,
  ): Promise<{ filename: string; content: Buffer; contentId: string } | null> {
    if (!key) {
      return null;
    }

    try {
      const object = await this.storage.getObject(key);

      if (!object) {
        return null;
      }

      const extension = object.mime.includes("png")
        ? "png"
        : object.mime.includes("webp")
          ? "webp"
          : "jpg";

      return { filename: `logo.${extension}`, content: object.bytes, contentId: LOGO_CONTENT_ID };
    } catch (error) {
      this.logger.warn(`Could not attach the clinic logo: ${String(error)}`);

      return null;
    }
  }
}
