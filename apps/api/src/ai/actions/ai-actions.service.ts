import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  addDays,
  AI_ACTION_BASE_TIER,
  AI_ACTION_CHECK,
  AI_ACTION_CHECKS,
  AI_ACTION_ERROR,
  AI_OUTBOUND_ERROR,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_RISK_TIER,
  AI_TOOL,
  AI_TOOL_ERROR,
  AI_ACTIONS_SETTINGS_KEY,
  aiActionsSettings,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  AUDIT_ACTION,
  canTransitionAppointment,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  GENDERS,
  instantFromLocal,
  localDate,
  LOOKUP_LIST,
  maxRiskTier,
  occupiesSlot,
  phoneSchema,
  toMinorUnits,
  wholeMoneySchema,
  type AiActionError,
  type AiActionResult,
  type AiActionsSettings,
  type AiActionSummary,
  type AiActionTool,
  type AiProposal,
  type AiProposalKind,
  type AiProposalStatusEvent,
  type AiRiskTier,
  type AuditAction,
  type CalendarAppointment,
  type PatientView,
} from "@clinic/shared";
import { and, asc, eq, gte, isNull, lt, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { OutboundError, statusEvent, toProposal } from "@api/ai/outbound/proposals.service";
import {
  ActionDone,
  defineTool,
  ProposalResult,
  ToolRefusal,
  type AiTool,
  type ToolAuditTarget,
} from "@api/ai/tools/ai-tool";
import { AppointmentAccessService } from "@api/appointments/appointment-access.service";
import { APPOINTMENTS_ENTITY, AppointmentsService } from "@api/appointments/appointments.service";
import { AvailabilityService } from "@api/appointments/availability.service";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { AuditService } from "@api/audit/audit.service";
import { LedgerService } from "@api/billing/ledger.service";
import { PAYMENTS_ENTITY, PaymentsService } from "@api/billing/payments.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import type { Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  aiAuditLog,
  aiProposals,
  appointments,
  clinics,
  lookupOptions,
  patients,
  visits,
} from "@api/database/schema";
import { DoctorsService } from "@api/doctors/doctors.service";
import { PATIENTS_ENTITY } from "@api/patients/patient-view";
import { PatientsService } from "@api/patients/patients.service";
import { PermissionsService } from "@api/permissions/permissions.service";

type ActionKind = Exclude<AiProposalKind, typeof AI_PROPOSAL_KIND.MESSAGE>;

/** What a `typed` card asks to be typed. In code: never in a row, and never in the model's context. */
export const TYPED_PHRASES: Record<ActionKind, string> = {
  [AI_PROPOSAL_KIND.APPOINTMENT_CREATE]: "تأكيد حجز الموعد",
  [AI_PROPOSAL_KIND.APPOINTMENT_UPDATE]: "تأكيد تعديل الموعد",
  [AI_PROPOSAL_KIND.APPOINTMENT_STATUS]: "تأكيد تغيير الحالة",
  [AI_PROPOSAL_KIND.APPOINTMENT_CANCEL]: "تأكيد إلغاء المواعيد",
  [AI_PROPOSAL_KIND.PATIENT_CREATE]: "تأكيد إضافة المريض",
  [AI_PROPOSAL_KIND.PATIENT_NOTE]: "تأكيد إضافة الملاحظة",
  [AI_PROPOSAL_KIND.PAYMENT_CREATE]: "تأكيد تسجيل الدفعة",
};

const DORMANT_AFTER_DAYS = 730;
const LARGE_CANCELLATION = 10;
const EXCEEDS_BALANCE_FACTOR = 3;
const NOTES_MAX_LENGTH = 2000;

/** The statuses the assistant may set, and the endpoint whose permission each borrows. */
const STATUS_CAPABILITY = {
  [APPOINTMENT_STATUS.CONFIRMED]: "appointments.confirm",
  [APPOINTMENT_STATUS.ARRIVED]: "appointments.arrived",
  [APPOINTMENT_STATUS.IN_PROGRESS]: "appointments.start",
  [APPOINTMENT_STATUS.COMPLETED]: "appointments.complete",
  [APPOINTMENT_STATUS.NO_SHOW]: "appointments.noShow",
} as const;
type SettableStatus = keyof typeof STATUS_CAPABILITY;
const SETTABLE_STATUSES = Object.keys(STATUS_CAPABILITY) as [SettableStatus, ...SettableStatus[]];

interface StatusPayload {
  readonly appointmentId: string;
  readonly status: SettableStatus;
}

/** Small and reversible run at once; the rest wait on a card. */
const AUTO_STATUSES: readonly SettableStatus[] = [
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.IN_PROGRESS,
  APPOINTMENT_STATUS.COMPLETED,
];

const acknowledgeSchema = z
  .array(z.enum(AI_ACTION_CHECKS))
  .optional()
  .describe(
    "Only after the user answered yes to a sanity_check you relayed: the check they answered.",
  );
const dateSchema = z.iso.date();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");

const statusSchema = z.object({
  appointment_id: z.uuid(),
  status: z.enum(SETTABLE_STATUSES),
  acknowledge: acknowledgeSchema,
});

/** A deterministic stop, told to the model as a result it relays — never retried around. */
class Stop {
  constructor(readonly forModel: Record<string, unknown>) {}
}

interface Draft<TPayload> {
  readonly payload: TPayload;
  readonly summary: AiActionSummary;
}

interface Executed {
  readonly result: AiActionResult | null;
  readonly audit: ToolAuditTarget;
}

interface ActionSpec<TSchema extends z.ZodType, TPayload> {
  readonly tool: AiActionTool;
  readonly kind: ActionKind;
  readonly description: string;
  readonly risk: AiRiskTier;
  /** The endpoint this borrows its permission from; `capabilityFor` narrows it per call. */
  readonly capability: string;
  readonly capabilityFor?: (payload: NoInfer<TPayload>) => string;
  readonly schema: TSchema;
  prepare(actor: AuthenticatedUser, args: z.output<TSchema>): Promise<Draft<TPayload> | Stop>;
  /** Raises the tier for what this call turned out to touch. It can never lower one. */
  readonly escalate?: (payload: NoInfer<TPayload>, settings: AiActionsSettings) => AiRiskTier;
  execute(actor: AuthenticatedUser, payload: NoInfer<TPayload>): Promise<Executed>;
}

/** The same spec with its payload type erased, so the registry holds one list. */
interface Action {
  readonly tool: AiActionTool;
  readonly kind: ActionKind;
  readonly risk: AiRiskTier;
  capabilityFor(payload: unknown): string;
  escalate(payload: unknown, settings: AiActionsSettings): AiRiskTier;
  execute(actor: AuthenticatedUser, payload: unknown): Promise<Executed>;
  asTool(service: AiActionsService): AiTool;
}

type ProposalRow = typeof aiProposals.$inferSelect;

// Every action the assistant can take, and the one path each takes whether it runs inside the tool
// call or on the card's button: the same domain service the screen calls, the same domain audit
// entry, and the same permission, asked again at the click.
@Injectable()
export class AiActionsService {
  private readonly logger = new Logger("Assistant");
  private actions: Action[] | undefined;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly appointments: AppointmentsService,
    private readonly access: AppointmentAccessService,
    private readonly availability: AvailabilityService,
    private readonly doctors: DoctorsService,
    private readonly patients: PatientsService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly permissions: PermissionsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  tools(): AiTool[] {
    return this.list().map((action) => action.asTool(this));
  }

  async settings(clinicId: string): Promise<AiActionsSettings> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return aiActionsSettings(row?.settings);
  }

  // Merged in place under its own key, so an edit here cannot overwrite what sits beside it.
  async updateSettings(
    actor: AuthenticatedUser,
    input: AiActionsSettings,
  ): Promise<AiActionsSettings> {
    await this.db
      .update(clinics)
      .set({
        settings: sql`${clinics.settings} || jsonb_build_object(${AI_ACTIONS_SETTINGS_KEY}::text, ${JSON.stringify(input)}::jsonb)`,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)));

    return this.settings(actor.clinicId);
  }

  /** The strictest of the code's tier, the clinic's floor, and what this call touched. */
  static resolveTier(
    code: AiRiskTier,
    clinicFloor: AiRiskTier | undefined,
    escalated: AiRiskTier,
  ): AiRiskTier {
    return maxRiskTier(code, clinicFloor ?? AI_RISK_TIER.AUTO, escalated);
  }

  async get(actor: AuthenticatedUser, id: string): Promise<AiProposal> {
    return toProposal(await this.requireOwn(actor, id));
  }

  async cancel(actor: AuthenticatedUser, id: string): Promise<AiProposalStatusEvent> {
    await this.requireOwn(actor, id);

    const [updated] = await this.db
      .update(aiProposals)
      .set({ status: AI_PROPOSAL_STATUS.CANCELLED, updatedAt: new Date(), updatedBy: actor.id })
      .where(and(eq(aiProposals.id, id), eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT)))
      .returning();

    if (!updated) {
      throw new OutboundError(AI_OUTBOUND_ERROR.NOT_PENDING, HttpStatus.CONFLICT);
    }

    return statusEvent(updated);
  }

  /**
   * The card's button. Everything is checked again at the click — author, status, expiry, the
   * clinic's switch, the permission, the tier and the phrase — then the claim flips `draft` to
   * `sending`, which is what stops a second click from running it twice.
   */
  async confirm(
    actor: AuthenticatedUser,
    id: string,
    typedPhrase: string | undefined,
  ): Promise<AiProposalStatusEvent> {
    const { row, action } = await this.claim(actor, id, typedPhrase);
    const started = Date.now();
    let executed: Executed | undefined;
    let failure: AiActionError | undefined;

    try {
      executed = await action.execute(actor, row.payload);
    } catch (error) {
      failure = domainFailure(action.kind, error);

      if (failure === AI_ACTION_ERROR.FAILED) {
        this.logger.error(`Action ${action.tool} failed: ${String(error)}`);
      }
    }

    await this.db.insert(aiAuditLog).values({
      clinicId: actor.clinicId,
      userId: actor.id,
      conversationId: row.conversationId,
      toolName: action.tool,
      argsJson: { proposal_id: row.id },
      outcome: failure ?? "ok",
      resultSize: 0,
      durationMs: Date.now() - started,
      proposalId: row.id,
      ...(executed && { entity: executed.audit.entity, entityId: executed.audit.entityId }),
    });

    const [done] = await this.db
      .update(aiProposals)
      .set({
        status: failure ? AI_PROPOSAL_STATUS.FAILED : AI_PROPOSAL_STATUS.DONE,
        errorCode: failure ?? null,
        resultEntity: executed?.result?.entity ?? null,
        resultId: executed?.result?.id ?? null,
        resultPatientId: executed?.result?.patientId ?? null,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(aiProposals.id, row.id))
      .returning();

    if (!done) {
      throw new Error(`Proposal ${row.id} vanished while running`);
    }

    return statusEvent(done);
  }

  /** Runs one action as the tool call, for the tier that needs nobody's click. */
  async runTool(
    action: Action,
    actor: AuthenticatedUser,
    conversationId: string,
    draft: Draft<unknown>,
  ): Promise<ActionDone | ProposalResult> {
    const settings = await this.settings(actor.clinicId);
    const tier = AiActionsService.resolveTier(
      action.risk,
      settings.minTier[action.tool],
      action.escalate(draft.payload, settings),
    );

    if (tier === AI_RISK_TIER.AUTO) {
      const executed = await action.execute(actor, draft.payload);

      return new ActionDone(
        { status: "done", kind: action.kind, result: executed.result },
        executed.audit,
      );
    }

    const proposal = await this.draft(actor, conversationId, action, draft, tier);

    // The id and the tier, never the summary: the person confirming reads it on the card, and the
    // model is not to narrate an action as done.
    return new ProposalResult(proposal, {
      proposal_id: proposal.id,
      kind: proposal.kind,
      status: "awaiting_user_confirmation",
      tier,
    });
  }

  async assertEnabled(actor: AuthenticatedUser, action: Action): Promise<void> {
    if ((await this.settings(actor.clinicId)).disabled.includes(action.tool)) {
      throw new ToolRefusal(AI_TOOL_ERROR.DISABLED);
    }
  }

  async assertAllowed(actor: AuthenticatedUser, capability: string): Promise<void> {
    if (!(await this.permissions.allows(actor.clinicId, actor.role, capability))) {
      throw new ForbiddenException();
    }
  }

  private async draft(
    actor: AuthenticatedUser,
    conversationId: string,
    action: Action,
    draft: Draft<unknown>,
    tier: AiRiskTier,
  ): Promise<AiProposal> {
    const ttl = this.config.get("AI_PROPOSAL_TTL_MINUTES", { infer: true });

    const [row] = await this.db
      .insert(aiProposals)
      .values({
        clinicId: actor.clinicId,
        userId: actor.id,
        conversationId,
        kind: action.kind,
        trigger: AI_OUTBOUND_TRIGGER.COMMAND,
        payload: draft.payload as Record<string, unknown>,
        tier,
        typedPhrase: tier === AI_RISK_TIER.TYPED ? TYPED_PHRASES[action.kind] : null,
        resolvedSummary: draft.summary,
        expiresAt: new Date(Date.now() + ttl * 60_000),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the proposal");
    }

    return toProposal(row);
  }

  private async claim(
    actor: AuthenticatedUser,
    id: string,
    typedPhrase: string | undefined,
  ): Promise<{ row: ProposalRow; action: Action }> {
    const settings = await this.settings(actor.clinicId);

    const claimed = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(aiProposals)
        .where(this.ownedBy(actor, id))
        .for("update");

      if (!row) {
        throw new NotFoundException("Resource not found");
      }

      const action = this.list().find((candidate) => candidate.kind === row.kind);

      if (!action) {
        throw new NotFoundException("Resource not found");
      }

      if (row.status === AI_PROPOSAL_STATUS.EXPIRED) {
        throw new OutboundError(AI_OUTBOUND_ERROR.EXPIRED, HttpStatus.CONFLICT);
      }

      if (row.status !== AI_PROPOSAL_STATUS.DRAFT) {
        throw new OutboundError(AI_OUTBOUND_ERROR.NOT_PENDING, HttpStatus.CONFLICT);
      }

      if (row.expiresAt.getTime() <= Date.now()) {
        return { expired: true } as const;
      }

      if (settings.disabled.includes(action.tool)) {
        throw new ActionRefusal(AI_ACTION_ERROR.DISABLED, HttpStatus.FORBIDDEN);
      }

      // The matrix may have changed since the draft; the one in force at the click decides.
      if (
        !(await this.permissions.allows(
          actor.clinicId,
          actor.role,
          action.capabilityFor(row.payload),
        ))
      ) {
        throw new ActionRefusal(AI_ACTION_ERROR.NOT_PERMITTED, HttpStatus.FORBIDDEN);
      }

      const tier = AiActionsService.resolveTier(
        row.tier ?? action.risk,
        settings.minTier[action.tool],
        action.escalate(row.payload, settings),
      );

      // Raised since the draft: recorded, so the card re-reads it and asks for the phrase.
      if (tier !== row.tier) {
        await tx
          .update(aiProposals)
          .set({
            tier,
            typedPhrase: tier === AI_RISK_TIER.TYPED ? TYPED_PHRASES[action.kind] : null,
            updatedAt: new Date(),
          })
          .where(eq(aiProposals.id, id));
      }

      // Exact, bar surrounding whitespace: a phrase that forgives typos is a button with extra steps.
      if (tier === AI_RISK_TIER.TYPED && typedPhrase?.trim() !== TYPED_PHRASES[action.kind]) {
        return { mismatch: true } as const;
      }

      const [taken] = await tx
        .update(aiProposals)
        .set({ status: AI_PROPOSAL_STATUS.SENDING, updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(aiProposals.id, id))
        .returning();

      if (!taken) {
        throw new NotFoundException("Resource not found");
      }

      return { row: taken, action } as const;
    });

    if ("mismatch" in claimed) {
      throw new ActionRefusal(AI_ACTION_ERROR.PHRASE_MISMATCH, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    if ("expired" in claimed) {
      await this.db
        .update(aiProposals)
        .set({ status: AI_PROPOSAL_STATUS.EXPIRED, updatedAt: new Date() })
        .where(and(eq(aiProposals.id, id), eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT)));

      throw new OutboundError(AI_OUTBOUND_ERROR.EXPIRED, HttpStatus.CONFLICT);
    }

    return { row: claimed.row, action: claimed.action };
  }

  private async requireOwn(actor: AuthenticatedUser, id: string): Promise<ProposalRow> {
    const [row] = await this.db.select().from(aiProposals).where(this.ownedBy(actor, id)).limit(1);

    if (!row) {
      // Somebody else's action is a 404, like somebody else's conversation.
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  // The author's own: an action is confirmed by the person who asked for it, nobody else.
  private ownedBy(actor: AuthenticatedUser, id: string) {
    return and(
      eq(aiProposals.id, id),
      eq(aiProposals.clinicId, actor.clinicId),
      eq(aiProposals.userId, actor.id),
      ne(aiProposals.kind, AI_PROPOSAL_KIND.MESSAGE),
    );
  }

  private list(): Action[] {
    this.actions ??= this.build();

    return this.actions;
  }

  private build(): Action[] {
    return [
      defineAction<typeof statusSchema, StatusPayload>({
        tool: AI_TOOL.SET_APPOINTMENT_STATUS,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_STATUS,
        description:
          "Move one appointment along: arrived, in_progress (started), completed — these run at " +
          "once and you say what was done — or confirmed / no_show, which wait on a card the user " +
          "confirms. Takes an appointment id from get_appointments.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.SET_APPOINTMENT_STATUS],
        capability: STATUS_CAPABILITY[APPOINTMENT_STATUS.ARRIVED],
        capabilityFor: (payload) => STATUS_CAPABILITY[payload.status],
        schema: statusSchema,
        prepare: async (actor, args) => {
          const appointment = await this.appointments.findOne(actor, args.appointment_id);

          if (!canTransitionAppointment(appointment.status, args.status)) {
            return new Stop({
              status: "not_possible",
              current_status: appointment.status,
              requested_status: args.status,
            });
          }

          const stop = await this.dormant(actor, appointment.patientId, args.acknowledge);

          return (
            stop ?? {
              payload: { appointmentId: appointment.id, status: args.status },
              summary: { ...appointmentSummary(appointment), status: args.status },
            }
          );
        },
        escalate: (payload) =>
          AUTO_STATUSES.includes(payload.status) ? AI_RISK_TIER.AUTO : AI_RISK_TIER.CONFIRM,
        execute: async (actor, payload) => {
          const appointment = await this.audited(
            actor,
            APPOINTMENTS_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.appointmentId,
            () => this.appointments.changeStatus(actor, payload.appointmentId, payload.status),
          );

          return appointmentResult(appointment);
        },
      }),

      defineAction({
        tool: AI_TOOL.ADD_PATIENT_NOTE,
        kind: AI_PROPOSAL_KIND.PATIENT_NOTE,
        description:
          "Append a short note to a patient's file. It is added after what is there; nothing is " +
          "edited or removed. Takes a patient id from search_patients.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.ADD_PATIENT_NOTE],
        capability: "patients.update",
        schema: z.object({
          patient_id: z.uuid(),
          note: z.string().trim().min(2).max(500),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const patient = await this.patients.findOne(actor, args.patient_id);
          const stop = await this.dormant(actor, patient.id, args.acknowledge);

          return (
            stop ?? {
              payload: { patientId: patient.id, note: args.note },
              summary: { patient: patientSummary(patient), note: args.note },
            }
          );
        },
        execute: async (actor, payload) => {
          const [row] = await this.db
            .select({ notes: patients.notes })
            .from(patients)
            .where(and(eq(patients.id, payload.patientId), eq(patients.clinicId, actor.clinicId)))
            .limit(1);

          const notes = row?.notes ? `${row.notes}\n${payload.note}` : payload.note;

          if (notes.length > NOTES_MAX_LENGTH) {
            throw new BadRequestException("The patient's notes are full");
          }

          await this.audited(actor, PATIENTS_ENTITY, AUDIT_ACTION.UPDATE, payload.patientId, () =>
            this.patients.update(actor, payload.patientId, { notes }),
          );

          return {
            result: { entity: "patient", id: payload.patientId, patientId: payload.patientId },
            audit: { entity: PATIENTS_ENTITY, entityId: payload.patientId },
          };
        },
      }),

      defineAction({
        tool: AI_TOOL.CREATE_APPOINTMENT,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_CREATE,
        description:
          "Book an appointment for a patient with a doctor at a local date and time (HH:MM). " +
          "The slot is checked first: slot_taken or slot_unavailable means ask the user for " +
          "another time — never try to force it. Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.CREATE_APPOINTMENT],
        capability: "appointments.create",
        schema: z.object({
          patient_id: z.uuid(),
          doctor_id: z.uuid(),
          date: dateSchema,
          time: timeSchema,
          duration_minutes: z.number().int().min(5).max(480).optional(),
          reason: z.string().trim().max(500).optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const [patient, doctor] = await Promise.all([
            this.patients.findOne(actor, args.patient_id),
            this.doctors.findOne(actor, args.doctor_id),
          ]);

          await this.access.requireOwnCalendar(actor, doctor.id);

          const slot = await this.slot(actor, {
            doctorId: doctor.id,
            date: args.date,
            time: args.time,
            durationMinutes: args.duration_minutes,
          });

          if (slot instanceof Stop) {
            return slot;
          }

          const stop = await this.dormant(actor, patient.id, args.acknowledge);

          return (
            stop ?? {
              payload: {
                patientId: patient.id,
                doctorId: doctor.id,
                startsAt: slot.startsAt,
                durationMinutes: slot.durationMinutes,
                reason: args.reason ?? null,
              },
              summary: {
                patient: patientSummary(patient),
                doctor: { id: doctor.id, name: doctor.user.name },
                startsAt: slot.startsAt,
                durationMinutes: slot.durationMinutes,
                ...(args.reason && { reason: args.reason }),
              },
            }
          );
        },
        execute: async (actor, payload) => {
          const appointment = await this.audited(
            actor,
            APPOINTMENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () =>
              this.appointments.create(actor, {
                patientId: payload.patientId,
                doctorId: payload.doctorId,
                startsAt: payload.startsAt,
                durationMinutes: payload.durationMinutes,
                type: APPOINTMENT_TYPE.CHECKUP,
                reason: payload.reason,
              }),
          );

          return appointmentResult(appointment);
        },
      }),

      defineAction({
        tool: AI_TOOL.RESCHEDULE_APPOINTMENT,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_UPDATE,
        description:
          "Move one appointment to another local date and time (HH:MM), optionally to another " +
          "doctor. Checked like a new booking; waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.RESCHEDULE_APPOINTMENT],
        capability: "appointments.update",
        schema: z.object({
          appointment_id: z.uuid(),
          date: dateSchema,
          time: timeSchema,
          doctor_id: z.uuid().optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const appointment = await this.appointments.findOne(actor, args.appointment_id);

          if (
            !occupiesSlot(appointment.status) ||
            appointment.status === APPOINTMENT_STATUS.COMPLETED
          ) {
            return new Stop({ status: "not_possible", current_status: appointment.status });
          }

          const doctor = await this.doctors.findOne(actor, args.doctor_id ?? appointment.doctorId);

          await this.access.requireOwnCalendar(actor, appointment.doctorId);
          await this.access.requireOwnCalendar(actor, doctor.id);

          const slot = await this.slot(actor, {
            doctorId: doctor.id,
            date: args.date,
            time: args.time,
            durationMinutes: appointment.durationMinutes,
            excludeAppointmentId: appointment.id,
          });

          if (slot instanceof Stop) {
            return slot;
          }

          const stop = await this.dormant(actor, appointment.patientId, args.acknowledge);

          return (
            stop ?? {
              payload: {
                appointmentId: appointment.id,
                doctorId: doctor.id,
                startsAt: slot.startsAt,
              },
              summary: {
                ...appointmentSummary(appointment),
                doctor: { id: doctor.id, name: doctor.user.name },
                startsAt: slot.startsAt,
                previousStartsAt: appointment.startsAt,
              },
            }
          );
        },
        execute: async (actor, payload) => {
          const appointment = await this.audited(
            actor,
            APPOINTMENTS_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.appointmentId,
            () =>
              this.appointments.update(actor, payload.appointmentId, {
                doctorId: payload.doctorId,
                startsAt: payload.startsAt,
              }),
          );

          return appointmentResult(appointment);
        },
      }),

      defineAction({
        tool: AI_TOOL.CANCEL_APPOINTMENTS,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_CANCEL,
        description:
          "Cancel one or more appointments by id, with the reason the user gave — ask for one " +
          "if they did not. Waits on a card the user confirms; several at once, or one with a " +
          "visit, need a typed confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.CANCEL_APPOINTMENTS],
        capability: "appointments.cancel",
        schema: z.object({
          appointment_ids: z
            .array(z.uuid())
            .min(1)
            .max(50)
            .refine((ids) => new Set(ids).size === ids.length, "Each id once"),
          reason: z.string().trim().min(3).max(500),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const targets = await Promise.all(
            args.appointment_ids.map((id) => this.appointments.findOne(actor, id)),
          );

          for (const target of targets) {
            await this.access.requireOwnCalendar(actor, target.doctorId);
          }

          const stuck = targets.filter(
            (target) => !canTransitionAppointment(target.status, APPOINTMENT_STATUS.CANCELLED),
          );

          if (stuck.length > 0) {
            return new Stop({
              status: "not_possible",
              appointments: stuck.map((target) => ({ id: target.id, status: target.status })),
            });
          }

          const acknowledged = args.acknowledge ?? [];

          if (
            !acknowledged.includes(AI_ACTION_CHECK.LARGE_CANCELLATION) &&
            (targets.length > LARGE_CANCELLATION || (await this.coversWholeDay(actor, targets)))
          ) {
            return sanityCheck(AI_ACTION_CHECK.LARGE_CANCELLATION, {
              count: targets.length,
              doctors: [
                ...new Map(targets.map((target) => [target.doctorId, target.doctorName])).values(),
              ],
            });
          }

          return {
            payload: {
              appointmentIds: targets.map((target) => target.id),
              reason: args.reason,
              linkedVisit: targets.some((target) => target.visitId !== null),
            },
            summary: {
              reason: args.reason,
              appointments: targets.map((target) => ({
                id: target.id,
                startsAt: target.startsAt,
                patientName: target.patientName,
                patientFileNumber: target.patientFileNumber,
                doctorName: target.doctorName,
              })),
            },
          };
        },
        escalate: (payload, settings) =>
          payload.appointmentIds.length > settings.cancelTypedAbove || payload.linkedVisit
            ? AI_RISK_TIER.TYPED
            : AI_RISK_TIER.AUTO,
        execute: async (actor, payload) => {
          let last: CalendarAppointment | undefined;

          for (const id of payload.appointmentIds) {
            last = await this.audited(actor, APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE, id, () =>
              this.appointments.changeStatus(
                actor,
                id,
                APPOINTMENT_STATUS.CANCELLED,
                payload.reason,
              ),
            );
          }

          if (!last) {
            throw new BadRequestException("Nothing to cancel");
          }

          // One link only makes sense for one appointment; several are listed on the card.
          return payload.appointmentIds.length === 1
            ? appointmentResult(last)
            : { result: null, audit: { entity: APPOINTMENTS_ENTITY, entityId: last.id } };
        },
      }),

      defineAction({
        tool: AI_TOOL.CREATE_PATIENT,
        kind: AI_PROPOSAL_KIND.PATIENT_CREATE,
        description:
          "Register a new patient with the name and phone the user gave. A phone another " +
          "patient already has comes back as possible_duplicate with their file number: ask " +
          "whether it is the same person. Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.CREATE_PATIENT],
        capability: "patients.create",
        schema: z.object({
          full_name: z.string().trim().min(2).max(160),
          phone: phoneSchema,
          date_of_birth: dateSchema.optional(),
          gender: z.enum(GENDERS).optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const existing = await this.samePhone(actor, args.phone);

          if (
            existing.length > 0 &&
            !(args.acknowledge ?? []).includes(AI_ACTION_CHECK.POSSIBLE_DUPLICATE)
          ) {
            return sanityCheck(AI_ACTION_CHECK.POSSIBLE_DUPLICATE, {
              existing: existing.map((row) => ({
                fileNumber: row.fileNumber,
                fullName: row.fullName,
              })),
            });
          }

          return {
            payload: {
              fullName: args.full_name,
              phone: args.phone,
              dateOfBirth: args.date_of_birth ?? null,
              gender: args.gender ?? null,
            },
            summary: {
              newPatient: {
                fullName: args.full_name,
                phone: args.phone,
                dateOfBirth: args.date_of_birth ?? null,
              },
            },
          };
        },
        execute: async (actor, payload) => {
          const patient = await this.audited(
            actor,
            PATIENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () => this.patients.create(actor, payload),
          );

          return {
            result: { entity: "patient", id: patient.id, patientId: patient.id },
            audit: { entity: PATIENTS_ENTITY, entityId: patient.id },
          };
        },
      }),

      defineAction({
        tool: AI_TOOL.RECORD_PAYMENT,
        kind: AI_PROPOSAL_KIND.PAYMENT_CREATE,
        description:
          "Record money a patient paid, as a whole amount in the clinic's currency, with the " +
          "payment method's code (omit it for the clinic's first method). A payment never edits " +
          "one already recorded. Waits on a card the user confirms; a large one needs a typed " +
          "confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.RECORD_PAYMENT],
        capability: "payments.create",
        schema: z.object({
          patient_id: z.uuid(),
          amount: z.number().int().min(1).max(99_999_999),
          method: z.string().trim().min(1).max(64).optional(),
          note: z.string().trim().max(500).optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const patient = await this.patients.findOne(actor, args.patient_id);
          const methods = await this.paymentMethods(actor.clinicId);
          const method = args.method ?? methods[0];

          if (!method || !methods.includes(method)) {
            return new Stop({ status: "unknown_method", methods });
          }

          const amount = wholeMoneySchema.parse(String(args.amount));
          const acknowledged = args.acknowledge ?? [];
          const { balance } = await this.ledger.balanceFor(actor.clinicId, patient.id);

          if (
            !acknowledged.includes(AI_ACTION_CHECK.EXCEEDS_BALANCE) &&
            toMinorUnits(amount) > EXCEEDS_BALANCE_FACTOR * Math.max(toMinorUnits(balance), 0)
          ) {
            return sanityCheck(AI_ACTION_CHECK.EXCEEDS_BALANCE, { amount, balance });
          }

          const stop = await this.dormant(actor, patient.id, acknowledged);

          return (
            stop ?? {
              payload: { patientId: patient.id, amount, method, note: args.note ?? null },
              summary: {
                patient: patientSummary(patient),
                amount,
                method,
                ...(args.note && { note: args.note }),
              },
            }
          );
        },
        escalate: (payload, settings) =>
          toMinorUnits(payload.amount) >= settings.paymentTypedAbove * 100
            ? AI_RISK_TIER.TYPED
            : AI_RISK_TIER.AUTO,
        execute: async (actor, payload) => {
          const payment = await this.audited(
            actor,
            PAYMENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () => this.payments.create(actor, payload),
          );

          return {
            result: { entity: "payment", id: payment.id, patientId: payload.patientId },
            audit: { entity: PAYMENTS_ENTITY, entityId: payment.id },
          };
        },
      }),
    ];
  }

  // What the audit interceptor does around a screen's request, done here because the assistant
  // calls the service directly: snapshot before, snapshot after, one entry with both.
  private async audited<TResult extends { id: string }>(
    actor: AuthenticatedUser,
    entity: string,
    action: AuditAction,
    knownId: string | undefined,
    run: () => Promise<TResult>,
  ): Promise<TResult> {
    const loader = this.auditSnapshots.get(entity);
    const before = loader && knownId ? await loader(knownId, actor.clinicId) : null;
    const result = await run();
    const after = loader ? await loader(result.id, actor.clinicId) : null;

    await this.audit.record({
      clinicId: actor.clinicId,
      userId: actor.id,
      action,
      entity,
      entityId: result.id,
      oldValue: before,
      newValue: after,
    });

    return result;
  }

  // `AvailabilityService` decides; this only reads its answer for the one minute asked about.
  private async slot(
    actor: AuthenticatedUser,
    query: {
      doctorId: string;
      date: string;
      time: string;
      durationMinutes: number | undefined;
      excludeAppointmentId?: string;
    },
  ): Promise<{ startsAt: string; durationMinutes: number } | Stop> {
    const day = await this.availability.forDay(actor.clinicId, {
      doctorId: query.doctorId,
      date: query.date,
      ...(query.durationMinutes !== undefined && { durationMinutes: query.durationMinutes }),
      ...(query.excludeAppointmentId && { excludeAppointmentId: query.excludeAppointmentId }),
    });
    const slot = day.slots.find((candidate) => candidate.start === query.time);

    if (slot?.available) {
      return { startsAt: slot.startsAt, durationMinutes: day.durationMinutes };
    }

    const blockers = slot ? await this.blockers(actor, query.doctorId, slot, query) : [];

    if (blockers.length > 0) {
      return new Stop({ status: "slot_taken", blockers });
    }

    return new Stop({
      status: "slot_unavailable",
      closed_reason: day.closedReason ?? "outside_hours",
      closed_note: day.closedNote,
    });
  }

  private async blockers(
    actor: AuthenticatedUser,
    doctorId: string,
    slot: { startsAt: string; end: string; start: string },
    query: { excludeAppointmentId?: string },
  ): Promise<{ startsAt: string; patientName: string; patientFileNumber: string }[]> {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(
      startsAt.getTime() + (minutes(slot.end) - minutes(slot.start)) * 60_000,
    );

    const rows = await this.db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        patientName: patients.fullName,
        patientFileNumber: patients.fileNumber,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(
        and(
          eq(appointments.clinicId, actor.clinicId),
          eq(appointments.doctorId, doctorId),
          isNull(appointments.deletedAt),
          lt(appointments.startsAt, endsAt),
          sql`${appointments.startsAt} + make_interval(mins => ${appointments.durationMinutes}) > ${startsAt.toISOString()}::timestamptz`,
        ),
      );

    return rows
      .filter((row) => occupiesSlot(row.status) && row.id !== query.excludeAppointmentId)
      .map((row) => ({
        startsAt: row.startsAt.toISOString(),
        patientName: row.patientName,
        patientFileNumber: row.patientFileNumber,
      }));
  }

  // "The whole day": every appointment the clinic still has on one of the dates targeted.
  private async coversWholeDay(
    actor: AuthenticatedUser,
    targets: readonly CalendarAppointment[],
  ): Promise<boolean> {
    if (targets.length < 2) {
      return false;
    }

    const timeZone = await this.timeZone(actor.clinicId);
    const days = new Set(targets.map((target) => localDate(new Date(target.startsAt), timeZone)));
    const ids = new Set(targets.map((target) => target.id));

    for (const day of days) {
      const rows = await this.db
        .select({ id: appointments.id, status: appointments.status })
        .from(appointments)
        .where(
          and(
            eq(appointments.clinicId, actor.clinicId),
            isNull(appointments.deletedAt),
            gte(appointments.startsAt, instantFromLocal(day, 0, timeZone)),
            lt(appointments.startsAt, instantFromLocal(addDays(day, 1), 0, timeZone)),
          ),
        );
      const live = rows.filter((row) => occupiesSlot(row.status));

      if (live.length >= 2 && live.every((row) => ids.has(row.id))) {
        return true;
      }
    }

    return false;
  }

  /** Somebody not seen in two years is as likely a namesake as the person meant. */
  private async dormant(
    actor: AuthenticatedUser,
    patientId: string,
    acknowledged: readonly string[] | undefined,
  ): Promise<Stop | null> {
    if ((acknowledged ?? []).includes(AI_ACTION_CHECK.DORMANT_PATIENT)) {
      return null;
    }

    const [row] = await this.db
      .select({ lastVisitAt: max(visits.visitDate) })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, actor.clinicId),
          eq(visits.patientId, patientId),
          isNull(visits.deletedAt),
        ),
      );

    const last = row?.lastVisitAt;

    if (!last || Date.now() - last.getTime() <= DORMANT_AFTER_DAYS * 86_400_000) {
      return null;
    }

    return sanityCheck(AI_ACTION_CHECK.DORMANT_PATIENT, { last_visit_at: last.toISOString() });
  }

  private async samePhone(
    actor: AuthenticatedUser,
    phone: string,
  ): Promise<{ fileNumber: string; fullName: string }[]> {
    const digits = phone.replaceAll(/\D/g, "");

    return this.db
      .select({ fileNumber: patients.fileNumber, fullName: patients.fullName })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, actor.clinicId),
          isNull(patients.deletedAt),
          sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${digits}`,
        ),
      )
      .limit(5);
  }

  private async paymentMethods(clinicId: string): Promise<string[]> {
    const rows = await this.db
      .select({ code: lookupOptions.code })
      .from(lookupOptions)
      .where(
        and(
          eq(lookupOptions.clinicId, clinicId),
          eq(lookupOptions.listKey, LOOKUP_LIST.PAYMENT_METHOD),
          eq(lookupOptions.isActive, true),
          isNull(lookupOptions.deletedAt),
        ),
      )
      .orderBy(asc(lookupOptions.sortOrder));

    return rows.map((row) => row.code);
  }

  private async timeZone(clinicId: string): Promise<string> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return clinicScheduleSettings(row?.settings).timezone || DEFAULT_TIME_ZONE;
  }
}

/** A refusal at the click, answered with a status and the code the card writes the Arabic for. */
export class ActionRefusal extends Error {
  constructor(
    readonly code: AiActionError,
    readonly status: HttpStatus,
  ) {
    super(code);
    this.name = "ActionRefusal";
  }
}

// Type-erases one spec, and turns it into the tool the model calls. The payload is only ever one
// this spec's own `prepare` wrote, so the cast back is to what went in.
function defineAction<TSchema extends z.ZodType, TPayload>(
  spec: ActionSpec<TSchema, TPayload>,
): Action {
  const action: Action = {
    tool: spec.tool,
    kind: spec.kind,
    risk: spec.risk,
    capabilityFor: (payload) => spec.capabilityFor?.(payload as TPayload) ?? spec.capability,
    escalate: (payload, settings) =>
      spec.escalate?.(payload as TPayload, settings) ?? AI_RISK_TIER.AUTO,
    execute: (actor, payload) => spec.execute(actor, payload as TPayload),
    asTool: (service) =>
      defineTool({
        name: spec.tool,
        description: spec.description,
        capability: spec.capability,
        risk: spec.risk,
        schema: spec.schema,
        run: async (actor, args, context) => {
          await service.assertEnabled(actor, action);

          const draft = await spec.prepare(actor, args);

          if (draft instanceof Stop) {
            return draft.forModel;
          }

          await service.assertAllowed(actor, action.capabilityFor(draft.payload));

          return service.runTool(action, actor, context.conversationId, draft);
        },
      }),
  };

  return action;
}

function sanityCheck(check: string, details: Record<string, unknown>): Stop {
  return new Stop({
    status: "sanity_check",
    check,
    ...details,
    instruction:
      "Stop and ask the user. Call again with acknowledge only if they answer that it is right.",
  });
}

function domainFailure(kind: ActionKind, error: unknown): AiActionError {
  if (error instanceof ConflictException) {
    return kind === AI_PROPOSAL_KIND.PATIENT_CREATE
      ? AI_ACTION_ERROR.DUPLICATE
      : AI_ACTION_ERROR.SLOT_TAKEN;
  }

  if (error instanceof NotFoundException) {
    return AI_ACTION_ERROR.NOT_FOUND;
  }

  if (error instanceof ForbiddenException) {
    return AI_ACTION_ERROR.NOT_PERMITTED;
  }

  if (error instanceof BadRequestException) {
    return AI_ACTION_ERROR.INVALID_TRANSITION;
  }

  return AI_ACTION_ERROR.FAILED;
}

const patientSummary = (patient: PatientView) => ({
  id: patient.id,
  fullName: patient.fullName,
  fileNumber: patient.fileNumber,
});

const appointmentSummary = (appointment: CalendarAppointment): AiActionSummary => ({
  patient: {
    id: appointment.patientId,
    fullName: appointment.patientName,
    fileNumber: appointment.patientFileNumber,
  },
  doctor: { id: appointment.doctorId, name: appointment.doctorName },
  startsAt: appointment.startsAt,
  durationMinutes: appointment.durationMinutes,
});

const appointmentResult = (appointment: CalendarAppointment): Executed => ({
  result: { entity: "appointment", id: appointment.id, patientId: appointment.patientId },
  audit: { entity: APPOINTMENTS_ENTITY, entityId: appointment.id },
});

const minutes = (time: string): number => {
  const [hours = 0, mins = 0] = time.split(":").map(Number);

  return hours * 60 + mins;
};
