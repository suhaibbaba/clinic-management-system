import { Inject, Injectable } from '@nestjs/common';
import {
  TIMELINE_ENTRY_TYPE,
  USER_ROLE,
  type ListTimelineQuery,
  type Paginated,
  type TimelineEntry,
  type TimelineEntryType,
  type UserRole,
} from '@clinic/shared';
import { sql, type SQL } from 'drizzle-orm';

import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { PatientAccessService } from '@api/patients/patient-access.service';

interface TimelineRow extends Record<string, unknown> {
  readonly id: string;
  readonly type: TimelineEntryType;
  readonly occurred_at: Date;
  readonly title: string;
  readonly detail: Record<string, unknown>;
}

/**
 * `GET /patients/:id/timeline` — one merged, reverse-chronological stream over
 * everything attached to the patient (CLAUDE.md: "…all appear in one timeline").
 *
 * The merge is a `UNION ALL` in SQL rather than five queries stitched together
 * in Node, because the page has to be cut across the merged stream: taking 20
 * rows from each table and sorting them afterwards would not paginate.
 *
 * Which entry types a caller receives is decided by role, never by the query
 * (ROLES.md patients matrix).
 */
@Injectable()
export class TimelineService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly patientAccess: PatientAccessService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    patientId: string,
    query: ListTimelineQuery,
  ): Promise<Paginated<TimelineEntry>> {
    await this.patientAccess.requirePatientId(actor, patientId);

    const allowed = allowedTypes(actor.role).filter(
      (type) => query.type === undefined || query.type === type,
    );

    if (allowed.length === 0) {
      return toPaginated<TimelineEntry>([], 0, query);
    }

    const sources = allowed
      .map((type) => this.source(type, actor.clinicId, patientId))
      .filter((source): source is SQL => source !== null);

    if (sources.length === 0) {
      return toPaginated<TimelineEntry>([], 0, query);
    }

    const entries = sql.join(sources, sql` union all `);
    const { limit, offset } = toLimitOffset(query);

    const [rows, totals] = await Promise.all([
      this.db.execute<TimelineRow>(
        sql`with entries as (${entries})
            select id, type, occurred_at, title, detail
            from entries
            order by occurred_at desc, id desc
            limit ${limit} offset ${offset}`,
      ),
      this.db.execute<{ value: number }>(
        sql`with entries as (${entries}) select count(*)::int as value from entries`,
      ),
    ]);

    return toPaginated([...rows].map(toTimelineEntry), totals[0]?.value ?? 0, query);
  }

  /**
   * One arm of the union per entry type. `null` marks a type whose table is
   * introduced by a later module — the arm appears once that module lands, and
   * until then the type simply contributes no rows.
   */
  private source(type: TimelineEntryType, clinicId: string, patientId: string): SQL | null {
    switch (type) {
      case TIMELINE_ENTRY_TYPE.VISIT:
        return sql`
          select v.id,
                 ${TIMELINE_ENTRY_TYPE.VISIT}::text as type,
                 v.visit_date as occurred_at,
                 coalesce(nullif(btrim(v.diagnosis), ''), nullif(btrim(v.complaint), ''), '') as title,
                 jsonb_build_object(
                   'visitId', v.id,
                   'doctorId', v.doctor_id,
                   'complaint', v.complaint,
                   'diagnosis', v.diagnosis
                 ) as detail
          from visits v
          where v.clinic_id = ${clinicId} and v.patient_id = ${patientId} and v.deleted_at is null`;

      case TIMELINE_ENTRY_TYPE.PROCEDURE:
        // Money is cast to text so it never round-trips through a JSON number.
        return sql`
          select pp.id,
                 ${TIMELINE_ENTRY_TYPE.PROCEDURE}::text as type,
                 pp.performed_at as occurred_at,
                 pc.name_ar as title,
                 jsonb_build_object(
                   'performedProcedureId', pp.id,
                   'procedureId', pp.procedure_id,
                   'doctorId', pp.doctor_id,
                   'visitId', pp.visit_id,
                   'status', pp.status,
                   'price', pp.price::text,
                   'discount', pp.discount::text
                 ) as detail
          from performed_procedures pp
          join procedure_catalog pc on pc.id = pp.procedure_id
          where pp.clinic_id = ${clinicId} and pp.patient_id = ${patientId} and pp.deleted_at is null`;

      case TIMELINE_ENTRY_TYPE.ATTACHMENT:
        // Metadata only: no object key, and no URL is minted for a list.
        return sql`
          select a.id,
                 ${TIMELINE_ENTRY_TYPE.ATTACHMENT}::text as type,
                 a.created_at as occurred_at,
                 a.filename as title,
                 jsonb_build_object(
                   'attachmentId', a.id,
                   'attachmentType', a.type,
                   'tooth', a.tooth,
                   'visitId', a.visit_id
                 ) as detail
          from attachments a
          where a.clinic_id = ${clinicId} and a.patient_id = ${patientId} and a.deleted_at is null`;

      case TIMELINE_ENTRY_TYPE.PRESCRIPTION:
        return sql`
          select pr.id,
                 ${TIMELINE_ENTRY_TYPE.PRESCRIPTION}::text as type,
                 pr.created_at as occurred_at,
                 coalesce(pr.items -> 0 ->> 'drug', '') as title,
                 jsonb_build_object(
                   'prescriptionId', pr.id,
                   'doctorId', pr.doctor_id,
                   'visitId', pr.visit_id,
                   'itemCount', jsonb_array_length(pr.items)
                 ) as detail
          from prescriptions pr
          where pr.clinic_id = ${clinicId} and pr.patient_id = ${patientId} and pr.deleted_at is null`;

      case TIMELINE_ENTRY_TYPE.TREATMENT_PLAN:
        return sql`
          select tp.id,
                 ${TIMELINE_ENTRY_TYPE.TREATMENT_PLAN}::text as type,
                 tp.created_at as occurred_at,
                 tp.title as title,
                 jsonb_build_object(
                   'treatmentPlanId', tp.id,
                   'doctorId', tp.doctor_id,
                   'status', tp.status
                 ) as detail
          from treatment_plans tp
          where tp.clinic_id = ${clinicId} and tp.patient_id = ${patientId} and tp.deleted_at is null`;

      // TODO(appointments) / TODO(billing): these tables do not exist yet, so a
      // receptionist — whose timeline is exactly these two types — currently
      // receives an empty page rather than anything they may not see.
      case TIMELINE_ENTRY_TYPE.APPOINTMENT:
      case TIMELINE_ENTRY_TYPE.PAYMENT:
      case TIMELINE_ENTRY_TYPE.CHARGE:
      default:
        return null;
    }
  }
}

/**
 * ROLES.md patients matrix: admin and doctor read the full timeline, a
 * receptionist only the financial and appointment entries, and a technician
 * none of it.
 */
export function allowedTypes(role: UserRole): TimelineEntryType[] {
  switch (role) {
    case USER_ROLE.ADMIN:
    case USER_ROLE.DOCTOR:
      return [
        TIMELINE_ENTRY_TYPE.VISIT,
        TIMELINE_ENTRY_TYPE.PROCEDURE,
        TIMELINE_ENTRY_TYPE.ATTACHMENT,
        TIMELINE_ENTRY_TYPE.PRESCRIPTION,
        TIMELINE_ENTRY_TYPE.TREATMENT_PLAN,
        TIMELINE_ENTRY_TYPE.APPOINTMENT,
        TIMELINE_ENTRY_TYPE.PAYMENT,
        TIMELINE_ENTRY_TYPE.CHARGE,
      ];
    case USER_ROLE.RECEPTIONIST:
      return [
        TIMELINE_ENTRY_TYPE.APPOINTMENT,
        TIMELINE_ENTRY_TYPE.PAYMENT,
        TIMELINE_ENTRY_TYPE.CHARGE,
      ];
    default:
      return [];
  }
}

function toTimelineEntry(row: TimelineRow): TimelineEntry {
  return {
    id: row.id,
    type: row.type,
    occurredAt: new Date(row.occurred_at).toISOString(),
    title: row.title,
    detail: row.detail,
  };
}
