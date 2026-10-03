import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AUDIT_ACTION,
  CLINIC_SECRET_ERROR,
  CLINIC_SECRET_KIND,
  CLINIC_SECRET_KINDS,
  type ClinicSecretKind,
  type ClinicSecrets,
  type UpdateClinicSecretsInput,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { type Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinicSecrets } from "@api/database/schema";
import { type WhatsAppCredentials } from "@api/common/types/whatsapp";
import { open, seal } from "@api/modules/secrets/lib/secret-cipher";
import { CLINIC_SECRETS_ENTITY } from "@api/common/constants/audit-entities";
import { described, context, SecretRow } from "@api/modules/secrets/lib/secrets";

@Injectable()
export class SecretsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  async status(clinicId: string): Promise<ClinicSecrets> {
    const rows = await this.rows(clinicId);
    const byKind = new Map(rows.map((row) => [row.kind, row]));

    return {
      encryptionAvailable: this.masterKey() !== null,
      secrets: Object.fromEntries(
        CLINIC_SECRET_KINDS.map((kind) => {
          const row = byKind.get(kind);

          return [
            kind,
            {
              set: row !== undefined,
              hint: row?.hint ?? null,
              updatedAt: row?.updatedAt.toISOString() ?? null,
            },
          ];
        }),
      ) as ClinicSecrets["secrets"],
    };
  }

  async update(actor: AuthenticatedUser, input: UpdateClinicSecretsInput): Promise<ClinicSecrets> {
    const changes = CLINIC_SECRET_KINDS.flatMap((kind) =>
      input[kind] === undefined ? [] : [{ kind, value: input[kind] }],
    );
    const masterKey = this.masterKey();

    if (!masterKey && changes.some((change) => change.value !== null)) {
      throw new HttpException(CLINIC_SECRET_ERROR.UNAVAILABLE, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    await this.db.transaction(async (tx) => {
      for (const { kind, value } of changes) {
        const [existing] = await tx
          .select()
          .from(clinicSecrets)
          .where(and(eq(clinicSecrets.clinicId, actor.clinicId), eq(clinicSecrets.kind, kind)))
          .for("update");

        if (value === null || value === undefined) {
          if (!existing) {
            continue;
          }

          await tx.delete(clinicSecrets).where(eq(clinicSecrets.id, existing.id));
          await this.audit.record(
            {
              clinicId: actor.clinicId,
              userId: actor.id,
              action: AUDIT_ACTION.DELETE,
              entity: CLINIC_SECRETS_ENTITY,
              entityId: existing.id,
              oldValue: described(existing),
              newValue: null,
            },
            tx,
          );
          continue;
        }

        const sealed = seal(masterKey as Buffer, value, context(actor.clinicId, kind));
        const [row] = await tx
          .insert(clinicSecrets)
          .values({
            clinicId: actor.clinicId,
            kind,
            ...sealed,
            hint: value.slice(-4),
            createdBy: actor.id,
            updatedBy: actor.id,
          })
          .onConflictDoUpdate({
            target: [clinicSecrets.clinicId, clinicSecrets.kind],
            set: { ...sealed, hint: value.slice(-4), updatedAt: new Date(), updatedBy: actor.id },
          })
          .returning();

        if (!row) {
          throw new Error("Failed to store the secret");
        }

        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: existing ? AUDIT_ACTION.UPDATE : AUDIT_ACTION.CREATE,
            entity: CLINIC_SECRETS_ENTITY,
            entityId: row.id,
            oldValue: existing ? described(existing) : null,
            newValue: described(row),
          },
          tx,
        );
      }
    });

    return this.status(actor.clinicId);
  }

  openAiKey(clinicId: string): Promise<string | null> {
    return this.reveal(clinicId, CLINIC_SECRET_KIND.OPENAI_API_KEY);
  }

  async whatsApp(clinicId: string): Promise<WhatsAppCredentials | null> {
    const [accessToken, phoneNumberId, templateName] = await Promise.all([
      this.reveal(clinicId, CLINIC_SECRET_KIND.WHATSAPP_ACCESS_TOKEN),
      this.reveal(clinicId, CLINIC_SECRET_KIND.WHATSAPP_PHONE_NUMBER_ID),
      this.reveal(clinicId, CLINIC_SECRET_KIND.WHATSAPP_TEMPLATE_NAME),
    ]);

    return accessToken && phoneNumberId && templateName
      ? { accessToken, phoneNumberId, templateName }
      : null;
  }

  private async reveal(clinicId: string, kind: ClinicSecretKind): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(clinicSecrets)
      .where(and(eq(clinicSecrets.clinicId, clinicId), eq(clinicSecrets.kind, kind)))
      .limit(1);

    const masterKey = this.masterKey();

    if (!row || !masterKey) {
      return null;
    }

    return open(masterKey, row, context(clinicId, kind));
  }

  private rows(clinicId: string): Promise<SecretRow[]> {
    return this.db.select().from(clinicSecrets).where(eq(clinicSecrets.clinicId, clinicId));
  }

  private masterKey(): Buffer | null {
    const encoded = this.config.get("SECRETS_MASTER_KEY", { infer: true });

    return encoded ? Buffer.from(encoded, "base64") : null;
  }
}
