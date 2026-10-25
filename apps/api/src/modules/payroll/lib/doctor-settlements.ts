import {
  LAB_COST_BEARER,
  LAB_ORDER_STATUS,
  MOVEMENT_TYPE,
  PAY_BASIS,
  PAY_PLAN_KIND,
  PERFORMED_PROCEDURE_STATUS,
  SETTLEMENT_LINE_STATUS,
  USER_ROLE,
  type SettlementItem,
  addMoney,
  formatMinorUnits,
  toMinorUnits,
  type Money,
  type SettlementLineStatus,
  type SettlementTotals,
  type SettlementTreatment,
  type ShareSplitEntry,
} from "@clinic/shared";
import { sql, type SQL } from "drizzle-orm";

export interface SettlementRow {
  readonly id: string;
  readonly doctor_id: string;
  readonly performed_at: Date | string;
  readonly patient_id: string;
  readonly patient_name: string;
  readonly file_number: string | null;
  readonly procedure_name: string;
  readonly price: string;
  readonly discount: string;
  readonly revenue: string;
  readonly tax_percent: string;
  readonly tax: string;
  readonly overhead_percent: string;
  readonly overhead: string;
  readonly suggested: string;
  readonly material: string;
  readonly material_set: boolean;
  readonly work_percent: string;
  readonly share_split: ShareSplitEntry[] | null;
  readonly percent: string;
  readonly percent_set: boolean;
  readonly net: string;
  readonly clinic_share: string;
  readonly doctor_share: string;
  readonly waived_reason: string | null;
  readonly collected_percent: string;
  readonly payable: string;
  readonly paid: string;
  readonly outstanding: string;
  readonly status: SettlementLineStatus;
  readonly last_paid_at: Date | string | null;
}

export interface SettlementItemRow {
  readonly payout_id: string;
  readonly treatment_id: string;
  readonly patient_id: string;
  readonly patient_name: string;
  readonly file_number: string | null;
  readonly procedure_name: string;
  readonly performed_at: Date | string;
  readonly amount: string;
}

export interface ShareTotals {
  readonly share: string;
  readonly payable: string;
  readonly paid: string;
}

export interface SettlementScope {
  readonly clinicId: string;
  readonly timeZone: string;
  readonly doctors?: SQL;
  readonly window?: SQL;
  readonly treatments?: SQL;
  readonly onPercentageOnly?: boolean;
}

export function toSettlementTreatment(row: SettlementRow): SettlementTreatment {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    performedAt: new Date(row.performed_at).toISOString(),
    patientId: row.patient_id,
    patientName: row.patient_name,
    fileNumber: row.file_number,
    procedureName: row.procedure_name,
    price: row.price,
    discount: row.discount,
    revenue: row.revenue,
    taxPercent: Number(row.tax_percent),
    tax: row.tax,
    overheadPercent: Number(row.overhead_percent),
    overhead: row.overhead,
    suggestedMaterialCost: row.suggested,
    materialCost: row.material,
    materialCostSet: row.material_set,
    workPercent: Number(row.work_percent),
    split: row.share_split,
    clinicSharePercent: Number(row.percent),
    clinicSharePercentSet: row.percent_set,
    net: row.net,
    clinicShare: row.clinic_share,
    doctorShare: row.doctor_share,
    waivedReason: row.waived_reason,
    collectedPercent: Number(row.collected_percent),
    payable: row.payable,
    paid: row.paid,
    outstanding: row.outstanding,
    status: row.status,
  };
}

export function toSettlementItem(row: SettlementItemRow): SettlementItem {
  return {
    treatmentId: row.treatment_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    fileNumber: row.file_number,
    procedureName: row.procedure_name,
    performedAt: new Date(row.performed_at).toISOString(),
    amount: row.amount,
  };
}

export const oneDoctor = (doctorId: string): SQL => sql`line.doctor_id = ${doctorId}`;

export const visitingDoctors: SQL = sql`line.role = ${USER_ROLE.VISITING_DOCTOR}`;

export const performedBetween = (start: Date, end: Date): SQL =>
  sql`p.performed_at >= ${start.toISOString()}::timestamptz and p.performed_at < ${end.toISOString()}::timestamptz`;

export function settlementLines(scope: SettlementScope): SQL {
  const { clinicId, timeZone } = scope;

  return sql`
    with treated as (
      select p.id,
             p.performed_at,
             p.patient_id,
             pt.full_name as patient_name,
             pt.file_number,
             pc.name as procedure_name,
             pc.tax_exempt,
             p.price,
             p.discount,
             p.material_cost,
             p.clinic_share_percent as own_percent,
             p.share_split,
             p.share_waived_reason,
             p.doctor_id as performer_id,
             date_trunc('month', p.performed_at at time zone ${timeZone})::date as month,
             (coalesce(lab.cost, 0) + coalesce(stock.cost, 0))::numeric(10, 2) as suggested
      from performed_procedures p
      join patients pt on pt.id = p.patient_id
      join procedure_catalog pc on pc.id = p.procedure_id
      left join lateral (
        select sum(lo.price) as cost
        from lab_orders lo
        where lo.performed_procedure_id = p.id
          and lo.deleted_at is null
          and (lo.status <> ${LAB_ORDER_STATUS.CANCELLED} or lo.cost_kept)
      ) lab on true
      left join lateral (
        select sum(
          abs(sm.quantity) * coalesce(
            sm.unit_price,
            (
              select bought.unit_price
              from stock_movements bought
              where bought.item_id = sm.item_id
                and bought.type = ${MOVEMENT_TYPE.PURCHASE}
                and bought.unit_price is not null
                and bought.reverses_id is null
                and bought.reversed_at is null
                and bought.created_at <= sm.created_at
              order by bought.created_at desc
              limit 1
            ),
            0
          )
        ) as cost
        from stock_movements sm
        where sm.performed_procedure_id = p.id
          and sm.reverses_id is null
          and sm.reversed_at is null
      ) stock on true
      where p.clinic_id = ${clinicId}
        and p.status = ${PERFORMED_PROCEDURE_STATUS.DONE}
        and p.deleted_at is null
        ${scope.window ? sql`and ${scope.window}` : sql``}
        ${scope.treatments ? sql`and ${scope.treatments}` : sql``}
    ),
    charge_units as (
      select c.patient_id,
             coalesce(c.performed_procedure_id, c.id) as unit,
             min(c.created_at) as first_at,
             sum(c.amount - c.discount) as charged
      from charges c
      where c.clinic_id = ${clinicId}
        and c.deleted_at is null
        and c.patient_id in (select patient_id from treated)
      group by c.patient_id, coalesce(c.performed_procedure_id, c.id)
    ),
    ordered as (
      select charge_units.*,
             coalesce(
               sum(charged) over (
                 partition by patient_id order by first_at, unit
                 rows between unbounded preceding and 1 preceding
               ),
               0
             ) as before
      from charge_units
      where charged > 0
    ),
    received as (
      select pay.patient_id, sum(pay.amount) as total
      from payments pay
      where pay.clinic_id = ${clinicId}
        and pay.deleted_at is null
        and pay.patient_id in (select patient_id from treated)
      group by pay.patient_id
    ),
    coverage as (
      select ordered.unit as treatment_id,
             ordered.charged,
             greatest(least(coalesce(received.total, 0) - ordered.before, ordered.charged), 0) as covered
      from ordered
      left join received on received.patient_id = ordered.patient_id
    ),
    line as (
      select treated.*,
             part.doctor_id,
             part.work_percent,
             u.role,
             coalesce(rule.tax_percent, 0) as rule_tax,
             coalesce(rule.overhead_percent, 0) as rule_overhead,
             coalesce(rule.basis::text, ${PAY_BASIS.DONE}) as basis,
             coalesce(rule.lab_cost_bearer::text, ${LAB_COST_BEARER.SHARED}) as bearer,
             (case when rate.found
                then coalesce(rate.clinic_share_percent, rule.clinic_share_percent, 0)
                else coalesce(d.clinic_share_percent, rule.clinic_share_percent, 0)
              end) as doctor_percent,
             u.role = ${USER_ROLE.VISITING_DOCTOR}
               or coalesce(plan.kind::text, ${PAY_PLAN_KIND.SALARY}) <> ${PAY_PLAN_KIND.SALARY}
               as on_percentage
      from treated
      cross join lateral (
        select (entry ->> 'doctorId')::uuid as doctor_id,
               (entry ->> 'workPercent')::numeric as work_percent
        from jsonb_array_elements(coalesce(treated.share_split, '[]'::jsonb)) entry
        union all
        select treated.performer_id, 100::numeric
        where treated.share_split is null
      ) part
      join doctors d on d.id = part.doctor_id
      join users u on u.id = d.user_id
      left join lateral (
        select r.tax_percent, r.overhead_percent, r.basis, r.lab_cost_bearer, r.clinic_share_percent
        from pay_rules r
        where r.clinic_id = ${clinicId} and r.effective_month <= treated.month
        order by r.effective_month desc, r.created_at desc
        limit 1
      ) rule on true
      left join lateral (
        select dr.clinic_share_percent, true as found
        from doctor_rates dr
        where dr.doctor_id = part.doctor_id and dr.effective_month <= treated.month
        order by dr.effective_month desc, dr.created_at desc
        limit 1
      ) rate on true
      left join lateral (
        select pp.kind
        from pay_plans pp
        where pp.user_id = d.user_id and pp.effective_month <= treated.month
        order by pp.effective_month desc, pp.created_at desc
        limit 1
      ) plan on true
    ),
    priced as (
      select line.*,
             (price - discount)::numeric(10, 2) as revenue,
             (case when tax_exempt then 0 else rule_tax end)::numeric(5, 2) as tax_percent,
             round((price - discount) * (case when tax_exempt then 0 else rule_tax end) / 100, 2)
               as tax,
             rule_overhead::numeric(5, 2) as overhead_percent,
             round((price - discount) * rule_overhead / 100, 2) as overhead,
             coalesce(material_cost, suggested)::numeric(10, 2) as material,
             material_cost is not null as material_set,
             coalesce(own_percent, doctor_percent)::numeric(5, 2) as percent,
             own_percent is not null as percent_set
      from line
      where true
        ${scope.onPercentageOnly === false ? sql`` : sql`and on_percentage`}
        ${scope.doctors ? sql`and ${scope.doctors}` : sql``}
    ),
    netted as (
      select priced.*,
             (revenue - tax - overhead
               - (case when bearer = ${LAB_COST_BEARER.SHARED} then material else 0 end)
             )::numeric(10, 2) as net
      from priced
    ),
    parted as (
      select netted.*,
             round(net * work_percent / 100, 2) as part,
             round(round(net * work_percent / 100, 2) * percent / 100, 2) as part_clinic,
             (case when bearer = ${LAB_COST_BEARER.DOCTOR}
                then round(material * work_percent / 100, 2) else 0 end) as doctor_material
      from netted
    ),
    shared as (
      select parted.*,
             (case when share_waived_reason is null
                then part - part_clinic - doctor_material else 0 end)::numeric(10, 2) as doctor_share,
             (case when share_waived_reason is null
                then part_clinic else part - doctor_material end)::numeric(10, 2) as clinic_share,
             (case when basis = ${PAY_BASIS.COLLECTED}
                then case when coverage.charged is null or coverage.charged <= 0 then 1
                          else coverage.covered / coverage.charged end
                else 1 end) as fraction
      from parted
      left join coverage on coverage.treatment_id = parted.id
    ),
    settled as (
      select shared.*,
             round(fraction * 100, 2)::numeric(5, 2) as collected_percent,
             round(doctor_share * fraction, 2)::numeric(10, 2) as payable,
             coalesce(paid.amount, 0)::numeric(10, 2) as paid,
             paid.last_paid_at
      from shared
      left join lateral (
        select sum(si.amount) as amount, max(sp.created_at) as last_paid_at
        from settlement_items si
        join staff_payments sp on sp.id = si.payout_id
        where si.performed_procedure_id = shared.id
          and si.doctor_id = shared.doctor_id
          and sp.reversed_at is null
          and sp.reverses_id is null
      ) paid on true
    )
    select settled.id,
           settled.doctor_id,
           settled.performed_at,
           settled.patient_id,
           settled.patient_name,
           settled.file_number,
           settled.procedure_name,
           settled.price,
           settled.discount,
           settled.revenue,
           settled.tax_percent,
           settled.tax::numeric(10, 2) as tax,
           settled.overhead_percent,
           settled.overhead::numeric(10, 2) as overhead,
           settled.suggested,
           settled.material,
           settled.material_set,
           settled.work_percent::numeric(5, 2) as work_percent,
           settled.share_split,
           settled.percent,
           settled.percent_set,
           settled.net,
           settled.clinic_share,
           settled.doctor_share,
           settled.share_waived_reason as waived_reason,
           settled.collected_percent,
           settled.payable,
           settled.paid,
           (settled.payable - settled.paid)::numeric(10, 2) as outstanding,
           (case when settled.payable = settled.paid then ${SETTLEMENT_LINE_STATUS.PAID}
                 when settled.paid = 0 then ${SETTLEMENT_LINE_STATUS.UNPAID}
                 else ${SETTLEMENT_LINE_STATUS.ADJUSTED} end) as status,
           settled.last_paid_at
    from settled
  `;
}

export function payoutItems(clinicId: string, payoutIds: readonly string[]): SQL {
  return sql`
    select si.payout_id,
           si.performed_procedure_id as treatment_id,
           p.patient_id,
           pt.full_name as patient_name,
           pt.file_number,
           pc.name as procedure_name,
           p.performed_at,
           si.amount
    from settlement_items si
    join performed_procedures p on p.id = si.performed_procedure_id
    join patients pt on pt.id = p.patient_id
    join procedure_catalog pc on pc.id = p.procedure_id
    where si.clinic_id = ${clinicId}
      and si.payout_id in (${sql.join(
        payoutIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
    order by p.performed_at desc
  `;
}

export function totalsOf(lines: readonly SettlementTreatment[]): SettlementTotals {
  return lines.reduce(
    (sum, line) => ({
      revenue: addMoney(sum.revenue, line.revenue),
      tax: addMoney(sum.tax, line.tax),
      overhead: addMoney(sum.overhead, line.overhead),
      materials: addMoney(sum.materials, line.materialCost),
      net: addMoney(sum.net, line.net),
      clinicShare: addMoney(sum.clinicShare, line.clinicShare),
      doctorShare: addMoney(sum.doctorShare, line.doctorShare),
      payable: addMoney(sum.payable, line.payable),
      paid: addMoney(sum.paid, line.paid),
      outstanding: addMoney(sum.outstanding, line.outstanding),
    }),
    {
      revenue: "0.00",
      tax: "0.00",
      overhead: "0.00",
      materials: "0.00",
      net: "0.00",
      clinicShare: "0.00",
      doctorShare: "0.00",
      payable: "0.00",
      paid: "0.00",
      outstanding: "0.00",
    },
  );
}

export function collectedRevenue(lines: readonly SettlementTreatment[]): Money {
  return formatMinorUnits(
    lines.reduce(
      (sum, line) =>
        sum + Math.round((toMinorUnits(line.revenue) * Math.min(line.collectedPercent, 100)) / 100),
      0,
    ),
  );
}

export const totalDiscount = (lines: readonly SettlementTreatment[]): Money =>
  lines.reduce((sum, line) => addMoney(sum, line.discount), "0.00");
