import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  CONTACT_MESSAGE_STATUS,
  WEBSITE_ERROR,
  type ContactMessage,
  type ContactMessageReceipt,
  type CreateContactMessageInput,
  type ListContactMessagesQuery,
  type Paginated,
  type UpdateContactMessageInput,
} from "@clinic/shared";
import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { CONTACT_MESSAGES_ENTITY } from "@api/common/constants/audit-entities";
import { DATABASE, type Database } from "@api/database/database.module";
import { contactMessages, users } from "@api/database/schema";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { WebsiteService } from "@api/modules/website/services/website.service";
import { CONTACT_MESSAGES_PER_PHONE_PER_DAY } from "@api/modules/website/constants";
import { toContactMessage, type ContactMessageRow } from "@api/modules/website/lib/website";

@Injectable()
export class ContactMessagesService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly website: WebsiteService,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(CONTACT_MESSAGES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select({ handledAt: contactMessages.handledAt, deletedAt: contactMessages.deletedAt })
        .from(contactMessages)
        .where(
          this.scope.whereIncludingDeleted(contactMessages, clinicId, eq(contactMessages.id, id)),
        )
        .limit(1);

      return row ?? null;
    });
  }

  async create(slug: string, input: CreateContactMessageInput): Promise<ContactMessageReceipt> {
    const clinic = await this.website.requirePublishedClinic(slug);

    if (!clinic.content.contact.formEnabled) {
      throw new HttpException(WEBSITE_ERROR.CONTACT_CLOSED, HttpStatus.FORBIDDEN);
    }

    const [recent] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(contactMessages)
      .where(
        and(
          eq(contactMessages.clinicId, clinic.id),
          eq(contactMessages.phone, input.phone),
          gt(contactMessages.createdAt, sql`now() - interval '1 day'`),
        ),
      );

    if ((recent?.value ?? 0) >= CONTACT_MESSAGES_PER_PHONE_PER_DAY) {
      throw new HttpException(WEBSITE_ERROR.TOO_MANY_MESSAGES, HttpStatus.TOO_MANY_REQUESTS);
    }

    const topic = input.topic
      ? clinic.content.contact.topics.find(
          (option) => option.ar === input.topic || option.en === input.topic,
        )
      : undefined;

    if (input.topic && !topic) {
      throw new BadRequestException("Unknown enquiry type");
    }

    await this.db.insert(contactMessages).values({
      clinicId: clinic.id,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      topic: topic?.ar ?? null,
      message: input.message,
    });

    return { received: true };
  }

  async list(
    actor: AuthenticatedUser,
    query: ListContactMessagesQuery,
  ): Promise<Paginated<ContactMessage>> {
    const where = this.scope.where(
      contactMessages,
      actor.clinicId,
      query.status === CONTACT_MESSAGE_STATUS.OPEN
        ? isNull(contactMessages.handledAt)
        : query.status === CONTACT_MESSAGE_STATUS.HANDLED
          ? isNotNull(contactMessages.handledAt)
          : undefined,
    );
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          message: contactMessages,
          handler: { nameAr: users.nameAr, nameEn: users.nameEn },
        })
        .from(contactMessages)
        .leftJoin(users, eq(users.id, contactMessages.handledBy))
        .where(where)
        .orderBy(desc(contactMessages.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(contactMessages)
        .where(where),
    ]);

    return toPaginated(
      rows.map((row) => toContactMessage(row.message, row.handler)),
      totals?.value ?? 0,
      query,
    );
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateContactMessageInput,
  ): Promise<ContactMessage> {
    await this.scope.findOneOrFail<ContactMessageRow>(contactMessages, actor.clinicId, id);
    const handled = input.status === CONTACT_MESSAGE_STATUS.HANDLED;

    await this.db
      .update(contactMessages)
      .set({
        handledAt: handled ? new Date() : null,
        handledBy: handled ? actor.id : null,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(contactMessages, actor.clinicId, eq(contactMessages.id, id)));

    return this.readOne(actor, id);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<ContactMessageRow>(contactMessages, actor.clinicId, id);

    await this.db
      .update(contactMessages)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(contactMessages, actor.clinicId, eq(contactMessages.id, id)));
  }

  private async readOne(actor: AuthenticatedUser, id: string): Promise<ContactMessage> {
    const [row] = await this.db
      .select({
        message: contactMessages,
        handler: { nameAr: users.nameAr, nameEn: users.nameEn },
      })
      .from(contactMessages)
      .leftJoin(users, eq(users.id, contactMessages.handledBy))
      .where(this.scope.where(contactMessages, actor.clinicId, eq(contactMessages.id, id)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return toContactMessage(row.message, row.handler);
  }
}
