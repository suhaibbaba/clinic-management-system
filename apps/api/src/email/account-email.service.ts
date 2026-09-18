import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { personName, type PersonName } from "@clinic/shared";
import type { Env } from "@api/config/env.schema";
import { EMAIL_PROVIDER, type EmailProvider } from "@api/email/email-provider";
import { renderEmail } from "@api/email/email-template";
import { StorageService } from "@api/storage/storage.service";

export type AccountEmailPurpose = "activate" | "reset";

export interface AccountEmailRecipient {
  readonly email: string;
  readonly name: PersonName;
}

export interface ClinicLetterhead {
  readonly name: PersonName;
  readonly logoKey: string | null;
  /** From clinic settings, which the admin already edits. Replies go here, not to the sender. */
  readonly email: string | null;
}

export interface IssuedToken {
  /** Goes in the email, and nowhere else. */
  readonly token: string;
  /** Goes in the database, so a stolen backup is not a set of live links. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

const LOGO_CONTENT_ID = "clinic-logo";

const COPY = {
  activate: {
    subject: (clinic: string) => `تفعيل حسابك في ${clinic}`,
    heading: "تفعيل الحساب",
    body: (who: string, clinic: string, hours: number) => [
      `مرحباً ${who},`,
      `تم إنشاء حساب لك في ${clinic}. اختر كلمة المرور الخاصة بك لتتمكن من الدخول.`,
      `الرابط صالح لمدة ${hours} ساعة.`,
    ],
    action: "تفعيل الحساب",
    footer: "إذا لم تكن تتوقع هذه الرسالة، تجاهلها ولن يتم إنشاء أي كلمة مرور.",
  },
  reset: {
    subject: (clinic: string) => `إعادة تعيين كلمة المرور — ${clinic}`,
    heading: "إعادة تعيين كلمة المرور",
    body: (who: string, clinic: string, hours: number) => [
      `مرحباً ${who},`,
      `وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في ${clinic}.`,
      `الرابط صالح لمدة ${hours} ساعة.`,
    ],
    action: "تعيين كلمة مرور جديدة",
    footer: "إذا لم تطلب ذلك، تجاهل هذه الرسالة — كلمة المرور الحالية تبقى كما هي.",
  },
} as const;

/** The email carries the token; the database only ever sees this. */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

@Injectable()
export class AccountEmailService {
  private readonly logger = new Logger("AccountEmail");

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly config: ConfigService<Env, true>,
    private readonly storage: StorageService,
  ) {}

  /** A fresh token every time, so a resend silently retires the link sent before it. */
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
