import type { CreateLabOrderInput, LabOrderRow, Paginated } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";
import { toQueryString } from "@web/shared/lib/query-string";

export const PATIENT_LAB_ORDERS_LIMIT = 100;

export const listPatientLabOrders = (patientId: string): Promise<Paginated<LabOrderRow>> =>
  apiRequest(`/lab-orders${toQueryString({ patientId, limit: PATIENT_LAB_ORDERS_LIMIT })}`);

export const createLabOrder = (body: CreateLabOrderInput): Promise<LabOrderRow> =>
  apiRequest("/lab-orders", { method: "POST", body });

export const deleteLabOrder = (id: string): Promise<void> =>
  apiRequest(`/lab-orders/${id}`, { method: "DELETE" });
