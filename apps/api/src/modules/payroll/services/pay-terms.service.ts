import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  PAYROLL_ERROR,
  STAFF_SHARE_BASIS,
  USER_ROLE,
  localDate,
  type PayPlan,
  type PayPlanInput,
  type PayPlanKind,
  type PayRule,
  type PayRules,
  type PayRulesInput,
  type PayrollMonth,
  type ShareTerm,
  type ShareTermsInput,
  type UserRole,
} from "@clinic/shared";
import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  doctorRates,
  doctors,
  payPlans,
  payRules,
  payrollMonths,
  shareTerms,
  users,
} from "@api/database/schema";
import {
  DOCTOR_RATES_ENTITY,
  PAY_PLANS_ENTITY,
  PAY_RULES_ENTITY,
  SHARE_TERMS_ENTITY,
} from "@api/common/constants/audit-entities";
import { monthOf, monthStart } from "@api/modules/payroll/lib/payroll";
import {
  defaultPayRule,
  defaultPlan,
  defaultShareTerms,
  toPayPlan,
  toPayRule,
  toShareTerm,
  type ShareTermsAt,
} from "@api/modules/payroll/lib/pay-terms";

@Injectable()
export class PayTermsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(PAY_RULES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(payRules)
        .where(and(eq(payRules.clinicId, clinicId), eq(payRules.id, id)))
        .limit(1);

      return row ? { ...toPayRule(row) } : null;
    });

    this.auditSnapshots.register(PAY_PLANS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(payPlans)
        .where(and(eq(payPlans.clinicId, clinicId), eq(payPlans.id, id)))
        .limit(1);

      return row ? { ...toPayPlan(row) } : null;
    });

    this.auditSnapshots.register(SHARE_TERMS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(shareTerms)
        .where(and(eq(shareTerms.clinicId, clinicId), eq(shareTerms.id, id)))
        .limit(1);

      return row ? { ...toShareTerm(row) } : null;
    });

    this.auditSnapshots.register(DOCTOR_RATES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(doctorRates)
        .where(and(eq(doctorRates.clinicId, clinicId), eq(doctorRates.id, id)))
        .limit(1);

      return row
        ? {
            doctorId: row.doctorId,
            clinicSharePercent: Number(row.clinicSharePercent),
            effectiveMonth: monthOf(row.effectiveMonth),
          }
        : null;
    });
  }

  async currentMonth(clinicId: string): Promise<PayrollMonth> {
    return monthOf(localDate(new Date(), await clinicTimeZone(this.db, clinicId)));
  }

  async payRules(actor: AuthenticatedUser): Promise<PayRules> {
    const month = await this.currentMonth(actor.clinicId);
    const rows = await this.db
      .select()
      .from(payRules)
      .where(eq(payRules.clinicId, actor.clinicId))
      .orderBy(desc(payRules.effectiveMonth), desc(payRules.createdAt));
    const history = rows.map(toPayRule);

    return {
      current: history.find((rule) => rule.effectiveMonth <= month) ?? defaultPayRule(month),
      history,
    };
  }

  async setPayRules(actor: AuthenticatedUser, input: PayRulesInput): Promise<PayRule> {
    await this.requireNotPast(actor.clinicId, input.effectiveMonth);

    const [row] = await this.db
      .insert(payRules)
      .values({
        clinicId: actor.clinicId,
        effectiveMonth: monthStart(input.effectiveMonth),
        taxPercent: String(input.taxPercent),
        overheadPercent: String(input.overheadPercent),
        basis: input.basis,
        labCostBearer: input.labCostBearer,
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the pay rules");
    }

    return toPayRule(row);
  }

  async planHistory(actor: AuthenticatedUser, userId: string): Promise<PayPlan[]> {
    await this.requireUser(actor.clinicId, userId);

    const rows = await this.db
      .select()
      .from(payPlans)
      .where(and(eq(payPlans.clinicId, actor.clinicId), eq(payPlans.userId, userId)))
      .orderBy(desc(payPlans.effectiveMonth), desc(payPlans.createdAt));

    return rows.map(toPayPlan);
  }

  async setPlan(actor: AuthenticatedUser, userId: string, input: PayPlanInput): Promise<PayPlan> {
    const role = await this.requireUser(actor.clinicId, userId);

    if (role === USER_ROLE.VISITING_DOCTOR) {
      throw new BadRequestException(PAYROLL_ERROR.NOT_EMPLOYEE);
    }
    await this.requireOpenFrom(actor.clinicId, input.effectiveMonth);

    const [row] = await this.db
      .insert(payPlans)
      .values({
        clinicId: actor.clinicId,
        userId,
        kind: input.kind,
        effectiveMonth: monthStart(input.effectiveMonth),
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the pay plan");
    }

    return toPayPlan(row);
  }

  async shareTermHistory(actor: AuthenticatedUser, userId: string): Promise<ShareTerm[]> {
    await this.requireUser(actor.clinicId, userId);

    const rows = await this.db
      .select()
      .from(shareTerms)
      .where(and(eq(shareTerms.clinicId, actor.clinicId), eq(shareTerms.userId, userId)))
      .orderBy(desc(shareTerms.effectiveMonth), desc(shareTerms.createdAt));

    return rows.map(toShareTerm);
  }

  async setShareTerms(
    actor: AuthenticatedUser,
    userId: string,
    input: ShareTermsInput,
  ): Promise<ShareTerm> {
    const role = await this.requireUser(actor.clinicId, userId);
    const isDoctor = (await this.doctorOf(actor.clinicId, userId)) !== null;

    if (role === USER_ROLE.VISITING_DOCTOR) {
      throw new BadRequestException(PAYROLL_ERROR.NOT_EMPLOYEE);
    }
    if (input.basis === STAFF_SHARE_BASIS.TREATMENTS && !isDoctor) {
      throw new BadRequestException(PAYROLL_ERROR.NOT_A_DOCTOR);
    }

    await this.requireOpenFrom(actor.clinicId, input.effectiveMonth);

    const [row] = await this.db
      .insert(shareTerms)
      .values({
        clinicId: actor.clinicId,
        userId,
        basis: input.basis,
        percent: String(input.basis === STAFF_SHARE_BASIS.TREATMENTS ? 0 : input.percent),
        effectiveMonth: monthStart(input.effectiveMonth),
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the share terms");
    }

    return toShareTerm(row);
  }

  async shareTermsAt(
    clinicId: string,
    people: readonly { id: string; role: UserRole; doctorId: string | null }[],
    month: PayrollMonth,
  ): Promise<Map<string, ShareTermsAt>> {
    const ids = people.map((person) => person.id);
    const rows =
      ids.length === 0
        ? []
        : await this.db
            .select({
              userId: shareTerms.userId,
              basis: shareTerms.basis,
              percent: shareTerms.percent,
            })
            .from(shareTerms)
            .where(
              and(
                eq(shareTerms.clinicId, clinicId),
                inArray(shareTerms.userId, ids),
                lte(shareTerms.effectiveMonth, monthStart(month)),
              ),
            )
            .orderBy(desc(shareTerms.effectiveMonth), desc(shareTerms.createdAt));

    return new Map(
      people.map((person) => {
        const row = rows.find((candidate) => candidate.userId === person.id);
        const fallback = defaultShareTerms(person.doctorId !== null);

        if (person.role === USER_ROLE.VISITING_DOCTOR || !row) {
          return [person.id, fallback];
        }
        if (row.basis === STAFF_SHARE_BASIS.TREATMENTS && person.doctorId === null) {
          return [person.id, fallback];
        }

        return [person.id, { basis: row.basis, percent: Number(row.percent) }];
      }),
    );
  }

  async plansAt(
    clinicId: string,
    people: readonly { id: string; role: UserRole }[],
    month: PayrollMonth,
  ): Promise<Map<string, PayPlanKind>> {
    const ids = people.map((person) => person.id);
    const rows =
      ids.length === 0
        ? []
        : await this.db
            .select({ userId: payPlans.userId, kind: payPlans.kind })
            .from(payPlans)
            .where(
              and(
                eq(payPlans.clinicId, clinicId),
                inArray(payPlans.userId, ids),
                lte(payPlans.effectiveMonth, monthStart(month)),
              ),
            )
            .orderBy(desc(payPlans.effectiveMonth), desc(payPlans.createdAt));

    return new Map(
      people.map((person) => [
        person.id,
        person.role === USER_ROLE.VISITING_DOCTOR
          ? defaultPlan(person.role)
          : (rows.find((row) => row.userId === person.id)?.kind ?? defaultPlan(person.role)),
      ]),
    );
  }

  async setDoctorRate(
    actor: AuthenticatedUser,
    doctorId: string,
    clinicSharePercent: number,
    effectiveMonth: PayrollMonth,
  ): Promise<string> {
    await this.requireNotPast(actor.clinicId, effectiveMonth);

    const [row] = await this.db
      .insert(doctorRates)
      .values({
        clinicId: actor.clinicId,
        doctorId,
        effectiveMonth: monthStart(effectiveMonth),
        clinicSharePercent: String(clinicSharePercent),
        createdBy: actor.id,
      })
      .returning({ id: doctorRates.id });

    if (!row) {
      throw new Error("Failed to record the doctor's rate");
    }

    return row.id;
  }

  async doctorRateAt(
    clinicId: string,
    doctor: { id: string; clinicSharePercent: string | null },
    month: PayrollMonth,
  ): Promise<number> {
    const [row] = await this.db
      .select({ percent: doctorRates.clinicSharePercent })
      .from(doctorRates)
      .where(
        and(
          eq(doctorRates.clinicId, clinicId),
          eq(doctorRates.doctorId, doctor.id),
          lte(doctorRates.effectiveMonth, monthStart(month)),
        ),
      )
      .orderBy(desc(doctorRates.effectiveMonth), desc(doctorRates.createdAt))
      .limit(1);

    return Number(row?.percent ?? doctor.clinicSharePercent ?? 0);
  }

  async requireOpenFrom(clinicId: string, month: PayrollMonth): Promise<void> {
    const [row] = await this.db
      .select({ month: payrollMonths.month })
      .from(payrollMonths)
      .where(
        and(
          eq(payrollMonths.clinicId, clinicId),
          sql`${payrollMonths.month} >= ${monthStart(month)}`,
        ),
      )
      .limit(1);

    if (row) {
      throw new ConflictException(PAYROLL_ERROR.MONTH_CLOSED);
    }
  }

  private async requireNotPast(clinicId: string, month: PayrollMonth): Promise<void> {
    if (month < (await this.currentMonth(clinicId))) {
      throw new BadRequestException(PAYROLL_ERROR.PAST_MONTH);
    }
  }

  private async requireUser(clinicId: string, userId: string): Promise<UserRole> {
    const [row] = await this.db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.clinicId, clinicId), eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row.role;
  }

  private async doctorOf(clinicId: string, userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(
        and(eq(doctors.clinicId, clinicId), eq(doctors.userId, userId), isNull(doctors.deletedAt)),
      )
      .limit(1);

    return row?.id ?? null;
  }
}
