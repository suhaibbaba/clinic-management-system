import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  LOOKUP_LIST,
  type CreateStaffPaymentInput,
  type StaffPayment,
  type StaffPaymentKind,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { staffPayments } from "@api/database/schema";
import { STAFF_PAYMENTS_ENTITY } from "@api/common/constants/audit-entities";
import { negate } from "@api/common/lib/money";
import { toStaffPayment } from "@api/modules/payroll/lib/payroll";

@Injectable()
export class StaffPaymentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(STAFF_PAYMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(staffPayments)
        .where(and(eq(staffPayments.clinicId, clinicId), eq(staffPayments.id, id)))
        .limit(1);

      return row ? { ...toStaffPayment(row) } : null;
    });
  }

  async record(
    actor: AuthenticatedUser,
    target: { userId: string; kind: StaffPaymentKind; month: string | null },
    input: CreateStaffPaymentInput,
  ): Promise<StaffPayment> {
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.PAYMENT_METHOD, input.method);

    const [row] = await this.db
      .insert(staffPayments)
      .values({
        clinicId: actor.clinicId,
        userId: target.userId,
        kind: target.kind,
        month: target.month,
        amount: input.amount,
        method: input.method,
        note: input.note ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the staff payment");
    }

    return toStaffPayment(row);
  }

  async reverse(actor: AuthenticatedUser, id: string, reason: string): Promise<StaffPayment> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(staffPayments)
        .where(and(eq(staffPayments.clinicId, actor.clinicId), eq(staffPayments.id, id)))
        .limit(1)
        .for("update");

      if (!original) {
        throw new NotFoundException("Resource not found");
      }
      if (original.reversesId !== null) {
        throw new BadRequestException("A reversing entry cannot itself be reversed");
      }
      if (original.reversedAt !== null) {
        throw new BadRequestException("This payment has already been reversed");
      }

      await tx
        .update(staffPayments)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(staffPayments.id, original.id));

      const [row] = await tx
        .insert(staffPayments)
        .values({
          clinicId: original.clinicId,
          userId: original.userId,
          kind: original.kind,
          month: original.month,
          amount: negate(original.amount),
          method: original.method,
          note: reason,
          reversesId: original.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to reverse the staff payment");
      }

      return toStaffPayment(row);
    });
  }
}
