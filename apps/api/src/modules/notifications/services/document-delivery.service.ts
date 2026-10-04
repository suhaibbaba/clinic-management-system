import { BadGatewayException, ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  DOCUMENT_SEND_ERROR,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATE,
  renderTemplate,
  type DocumentDelivery,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { type Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { notificationsLog } from "@api/database/schema";
import { documentStrings } from "@api/modules/billing/pdf/document-strings";
import { LetterheadService } from "@api/modules/billing/pdf/letterhead.service";
import { NOTIFICATION_PROVIDER } from "@api/modules/notifications/constants";
import {
  whatsAppCredentials,
  type NotificationProvider,
} from "@api/modules/notifications/lib/notification-provider";
import { type SendDocument } from "@api/modules/notifications/lib/notifications";
import { NotificationsService } from "@api/modules/notifications/services/notifications.service";
import { WhatsAppNotificationProvider } from "@api/modules/notifications/services/notification-provider";
import { SecretsService } from "@api/modules/secrets/services/secrets.service";
import { type WhatsAppCredentials } from "@api/common/types/whatsapp";

@Injectable()
export class DocumentDeliveryService {
  private readonly logger = new Logger(DocumentDeliveryService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
    private readonly whatsapp: WhatsAppNotificationProvider,
    private readonly secrets: SecretsService,
    private readonly notifications: NotificationsService,
    private readonly letterheads: LetterheadService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async availability(clinicId: string): Promise<DocumentDelivery> {
    return { available: (await this.route(clinicId)) !== null };
  }

  async send(input: SendDocument): Promise<void> {
    const route = await this.route(input.clinicId);

    if (route === null) {
      throw new ConflictException(DOCUMENT_SEND_ERROR.UNAVAILABLE);
    }

    const clinic = await this.letterheads.load(input.clinicId);
    const title = documentStrings(clinic.language)[input.kind].title;
    const settings = await this.notifications.settingsFor(input.clinicId);
    const vars = { document: title, clinic: clinic.name };
    const custom = settings.templates[NOTIFICATION_TEMPLATE.DOCUMENT];
    const caption = renderTemplate(
      typeof custom === "string" && custom.trim() !== ""
        ? custom
        : DEFAULT_NOTIFICATION_TEMPLATES[NOTIFICATION_TEMPLATE.DOCUMENT],
      vars,
    );

    const [row] = await this.db
      .insert(notificationsLog)
      .values({
        clinicId: input.clinicId,
        to: input.to,
        channel: NOTIFICATION_CHANNEL.WHATSAPP,
        template: NOTIFICATION_TEMPLATE.DOCUMENT,
        vars,
        status: NOTIFICATION_STATUS.QUEUED,
      })
      .returning({ id: notificationsLog.id });

    if (!row) {
      throw new Error("Failed to record the notification");
    }

    try {
      if (route === "log") {
        await this.provider.send({
          to: input.to,
          channel: NOTIFICATION_CHANNEL.WHATSAPP,
          body: `${caption} [${title}.pdf, ${input.pdf.length} bytes]`,
        });
      } else {
        await this.whatsapp.sendDocumentWith(route, {
          to: input.to,
          pdf: input.pdf,
          filename: `${title}.pdf`,
          caption,
        });
      }

      await this.db
        .update(notificationsLog)
        .set({ status: NOTIFICATION_STATUS.SENT })
        .where(eq(notificationsLog.id, row.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Document to ${input.to} failed: ${message}`);

      await this.db
        .update(notificationsLog)
        .set({ status: NOTIFICATION_STATUS.FAILED, error: message.slice(0, 500) })
        .where(eq(notificationsLog.id, row.id));

      throw new BadGatewayException(DOCUMENT_SEND_ERROR.FAILED);
    }
  }

  private async route(clinicId: string): Promise<WhatsAppCredentials | "log" | null> {
    if (this.config.get("NODE_ENV", { infer: true }) !== "test") {
      const own = await this.secrets.whatsApp(clinicId);

      if (own?.documentTemplateName) {
        return own;
      }

      const shared = whatsAppCredentials(this.config);

      if (shared?.documentTemplateName) {
        return shared;
      }
    }

    return this.provider.name === "log" ? "log" : null;
  }
}
