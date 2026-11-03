import type {
  CreateLabOrderInput,
  LabOrderAttachment,
  LabOrderRow,
  Paginated,
  PresignAttachmentUploadResponse,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";
import { toQueryString } from "@web/shared/lib/query-string";
import { uploadToStorage } from "@web/shared/lib/upload";

export const PATIENT_LAB_ORDERS_LIMIT = 100;

export const listPatientLabOrders = (patientId: string): Promise<Paginated<LabOrderRow>> =>
  apiRequest(`/lab-orders${toQueryString({ patientId, limit: PATIENT_LAB_ORDERS_LIMIT })}`);

export const createLabOrder = (body: CreateLabOrderInput): Promise<LabOrderRow> =>
  apiRequest("/lab-orders", { method: "POST", body });

export const deleteLabOrder = (id: string): Promise<void> =>
  apiRequest(`/lab-orders/${id}`, { method: "DELETE" });

export async function uploadLabOrderAttachment(
  orderId: string,
  file: File,
): Promise<LabOrderAttachment> {
  const presigned = await apiRequest<PresignAttachmentUploadResponse>(
    `/lab-orders/${orderId}/attachments/presign`,
    { method: "POST", body: { filename: file.name, mime: file.type } },
  );

  await uploadToStorage(presigned.uploadUrl, file);

  return apiRequest(`/lab-orders/${orderId}/attachments`, {
    method: "POST",
    body: { key: presigned.key, filename: file.name },
  });
}
