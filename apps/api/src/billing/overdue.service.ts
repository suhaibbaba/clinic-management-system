import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_OVERDUE_AFTER_DAYS,
  formatMinorUnits,
  OVERDUE_AFTER_DAYS_SETTING,
  toMinorUnits,
  type ListOverdueQuery,
  type Money,
  type OverduePatient,
  type Paginated,
} from '@clinic/shared';
import { eq, sql } from 'drizzle-orm';

import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinics } from '@api/database/schema';

/** The clinic-wide aggregate behind the dashboard's overdue card. */
export interface OverdueTotal {
  readonly total: Money;
  readonly patients: number;
}

interface OverdueRow extends Record<string, unknown> {
  readonly patient_id: string;
  readonly file_number: string;
  readonly full_name: string;
  readonly phone: string;
  readonly balance: string;
  readonly last_payment_at: Date | string | null;
  readonly total: number;
}

/**
 * Patients who owe money and have not paid recently.
 *
 * "Recently" is a clinic setting, not a constant: a clinic that bills monthly
 * and one that expects payment on the day mean different things by overdue.
 *
 * The whole thing is one aggregate over the ledgers — there is no stored
 * balance and no "last payment" column to drift out of date.
 */
@Injectable()
export class OverdueService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(clinicId: string, query: ListOverdueQuery): Promise<Paginated<OverduePatient>> {
    const afterDays = query.afterDays ?? (await this.overdueAfterDays(clinicId));
    const { limit, offset } = toLimitOffset(query);

    const rows = await this.db.execute<OverdueRow>(sql`
      with ledger as (
        select
          p.id as patient_id,
          p.file_number,
          p.full_name,
          p.phone,
          coalesce((
            select sum(amount - discount) from charges
            where clinic_id = ${clinicId} and patient_id = p.id and deleted_at is null
          ), 0) as charged,
          coalesce((
            select sum(amount) from payments
            where clinic_id = ${clinicId} and patient_id = p.id and deleted_at is null
          ), 0) as paid,
          (
            select max(created_at) from payments
            where clinic_id = ${clinicId} and patient_id = p.id
              and deleted_at is null and amount > 0
          ) as last_payment_at
        from patients p
        where p.clinic_id = ${clinicId} and p.deleted_at is null
      ),
      overdue as (
        select *, (charged - paid) as balance from ledger
        where charged - paid > 0
          and (
            last_payment_at is null
            or last_payment_at < now() - ${sql.raw(`interval '${afterDays} days'`)}
          )
      )
      select patient_id::text as patient_id, file_number, full_name, phone,
             balance::text as balance, last_payment_at,
             count(*) over ()::int as total
      from overdue
      order by balance desc, full_name asc
      limit ${limit} offset ${offset}
    `);

    const items = [...rows].map((row) => toOverduePatient(row));

    return toPaginated(items, rows[0]?.total ?? 0, query);
  }

  /**
   * One line: what the whole clinic is owed past its window, and by how many
   * patients.
   *
   * The list above paginates, so the dashboard cannot get this by adding a
   * page up — and a page's subtotal presented as the clinic's debt would be
   * wrong on a financial screen, which is worse than absent. Same `with`
   * clause as `list`, without the window function or the page.
   */
  async total(clinicId: string, afterDays?: number): Promise<OverdueTotal> {
    const days = afterDays ?? (await this.overdueAfterDays(clinicId));

    const rows = await this.db.execute<{ total: string; patients: number }>(sql`
      with ledger as (
        select
          p.id as patient_id,
          coalesce((
            select sum(amount - discount) from charges
            where clinic_id = ${clinicId} and patient_id = p.id and deleted_at is null
          ), 0) as charged,
          coalesce((
            select sum(amount) from payments
            where clinic_id = ${clinicId} and patient_id = p.id and deleted_at is null
          ), 0) as paid,
          (
            select max(created_at) from payments
            where clinic_id = ${clinicId} and patient_id = p.id
              and deleted_at is null and amount > 0
          ) as last_payment_at
        from patients p
        where p.clinic_id = ${clinicId} and p.deleted_at is null
      ),
      overdue as (
        select (charged - paid) as balance from ledger
        where charged - paid > 0
          and (
            last_payment_at is null
            or last_payment_at < now() - ${sql.raw(`interval '${days} days'`)}
          )
      )
      select coalesce(sum(balance), 0)::text as total, count(*)::int as patients from overdue
    `);

    const row = rows[0];

    return {
      total: formatMinorUnits(toMinorUnits(row?.total ?? '0')),
      patients: row?.patients ?? 0,
    };
  }

  /** The clinic's overdue window, falling back to the shared default. */
  private async overdueAfterDays(clinicId: string): Promise<number> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    const configured = row?.settings?.[OVERDUE_AFTER_DAYS_SETTING];

    return typeof configured === 'number' && Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_OVERDUE_AFTER_DAYS;
  }
}

function toOverduePatient(row: OverdueRow): OverduePatient {
  const lastPaymentAt = row.last_payment_at ? new Date(row.last_payment_at) : null;

  return {
    patientId: row.patient_id,
    fileNumber: row.file_number,
    fullName: row.full_name,
    phone: row.phone,
    balance: formatMinorUnits(toMinorUnits(row.balance)),
    lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : null,
    daysSinceLastPayment: lastPaymentAt
      ? Math.floor((Date.now() - lastPaymentAt.getTime()) / 86_400_000)
      : null,
  };
}
