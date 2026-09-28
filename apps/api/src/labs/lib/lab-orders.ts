import { labOrders, labs, patients } from "@api/database/schema";
import { sql, type AnyColumn, type SQL, desc, asc, and, isNotNull, lt, inArray } from "drizzle-orm";
import {
  LAB_ORDER_STATUS,
  type ListLabOrdersQuery,
  LAB_ORDER_AWAITING_STATUSES,
  type LabOrder,
  type LabOrderRow,
  type LabOrderSort,
  awaitingLab,
} from "@clinic/shared";
import { toPersonName } from "@api/common/person-name";

export type OrderRow = typeof labOrders.$inferSelect;

export const finishedAt = sql`coalesce(${labOrders.fittedAt}, ${labOrders.updatedAt})`;

export const dueAt = sql`case when ${labOrders.status} = ${LAB_ORDER_STATUS.RECEIVED} then null else ${labOrders.expectedAt} end`;

export const SORT_KEYS: Record<
  LabOrderSort,
  { readonly key: SQL | AnyColumn; readonly dir: "asc" | "desc" }
> = {
  due: { key: dueAt, dir: "asc" },
  sent: { key: labOrders.sentAt, dir: "desc" },
  finished: { key: finishedAt, dir: "desc" },
  patient: { key: patients.fullName, dir: "asc" },
  lab: { key: labs.name, dir: "asc" },
};

export function orderFor(query: ListLabOrdersQuery): SQL[] {
  const sort =
    query.sort ?? (query.view === "open" ? "due" : query.view === "done" ? "finished" : null);

  if (sort === null) {
    return [desc(labOrders.createdAt)];
  }

  const { key, dir: fallback } = SORT_KEYS[sort];
  const dir = query.dir ?? fallback;

  return [
    dir === "asc" ? sql`${key} asc nulls last` : sql`${key} desc nulls last`,
    desc(labOrders.createdAt),
    asc(labOrders.id),
  ];
}

export function overdueFilter(): SQL {
  return and(
    isNotNull(labOrders.expectedAt),
    lt(labOrders.expectedAt, sql`now()`),
    inArray(labOrders.status, [...LAB_ORDER_AWAITING_STATUSES]),
  ) as SQL;
}

export function toLabOrder(row: OrderRow): LabOrder {
  return {
    id: row.id,
    clinicId: row.clinicId,
    labId: row.labId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    performedProcedureId: row.performedProcedureId,
    workTypeId: row.workTypeId,
    material: row.material,
    shade: row.shade,
    teeth: row.teeth,
    instructions: row.instructions,
    price: row.price,
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? null,
    expectedAt: row.expectedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    fittedAt: row.fittedAt?.toISOString() ?? null,
    returnReason: row.returnReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface JoinedOrderRow {
  readonly order: OrderRow;
  readonly patientName: string;
  readonly patientFileNumber: string;
  readonly doctorNameAr: string;
  readonly doctorNameEn: string;
  readonly labName: string;
  readonly workTypeName: string | null;
}

export function toLabOrderRow(row: JoinedOrderRow): LabOrderRow {
  const order = toLabOrder(row.order);

  return {
    ...order,
    patientName: row.patientName,
    patientFileNumber: row.patientFileNumber,
    doctorName: toPersonName(row.doctorNameAr, row.doctorNameEn),
    labName: row.labName,
    workTypeName: row.workTypeName,
    isOverdue:
      order.expectedAt !== null &&
      awaitingLab(order.status) &&
      new Date(order.expectedAt) < new Date(),
  };
}
