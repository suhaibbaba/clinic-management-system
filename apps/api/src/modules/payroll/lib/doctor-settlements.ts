import {
  LAB_ORDER_STATUS,
  MOVEMENT_TYPE,
  PERFORMED_PROCEDURE_STATUS,
  USER_ROLE,
  type SettlementTreatment,
} from "@clinic/shared";
import { sql, type SQL } from "drizzle-orm";

export interface SettlementRow {
  readonly id: string;
  readonly performed_at: Date | string;
  readonly patient_id: string;
  readonly patient_name: string;
  readonly procedure_name: string;
  readonly price: string;
  readonly discount: string;
  readonly suggested: string;
  readonly material: string;
  readonly material_set: boolean;
  readonly percent: string;
  readonly percent_set: boolean;
  readonly net: string;
  readonly clinic_share: string;
  readonly doctor_share: string;
}

export function toSettlementTreatment(row: SettlementRow): SettlementTreatment {
  return {
    id: row.id,
    performedAt: new Date(row.performed_at).toISOString(),
    patientId: row.patient_id,
    patientName: row.patient_name,
    procedureName: row.procedure_name,
    price: row.price,
    discount: row.discount,
    suggestedMaterialCost: row.suggested,
    materialCost: row.material,
    materialCostSet: row.material_set,
    clinicSharePercent: Number(row.percent),
    clinicSharePercentSet: row.percent_set,
    net: row.net,
    clinicShare: row.clinic_share,
    doctorShare: row.doctor_share,
  };
}

export const visitingDoctors: SQL = sql`p.doctor_id in (
  select vd.id from doctors vd join users vu on vu.id = vd.user_id
  where vu.role = ${USER_ROLE.VISITING_DOCTOR}
)`;

export const oneDoctor = (doctorId: string): SQL => sql`p.doctor_id = ${doctorId}`;

export function settlementRows(clinicId: string, doctors: SQL, window?: SQL): SQL {
  return sql`
    with base as (
      select p.id,
             p.performed_at,
             p.patient_id,
             pt.full_name as patient_name,
             pc.name as procedure_name,
             p.price,
             p.discount,
             (coalesce(lab.cost, 0) + coalesce(stock.cost, 0))::numeric(10, 2) as suggested,
             p.material_cost,
             p.clinic_share_percent as own_percent,
             coalesce(d.clinic_share_percent, 0) as doctor_percent
      from performed_procedures p
      join doctors d on d.id = p.doctor_id
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
        and ${doctors}
        and p.status = ${PERFORMED_PROCEDURE_STATUS.DONE}
        and p.deleted_at is null
        ${window ? sql`and ${window}` : sql``}
    ),
    priced as (
      select base.*,
             coalesce(material_cost, suggested)::numeric(10, 2) as material,
             material_cost is not null as material_set,
             coalesce(own_percent, doctor_percent)::numeric(5, 2) as percent,
             own_percent is not null as percent_set,
             (price - discount - coalesce(material_cost, suggested))::numeric(10, 2) as net
      from base
    )
    select priced.*,
           round(net * percent / 100, 2)::numeric(10, 2) as clinic_share,
           (net - round(net * percent / 100, 2))::numeric(10, 2) as doctor_share
    from priced
  `;
}
