import { z } from "zod";
import { paginationQuerySchema } from "@shared/schemas/common";

export const drugRegimenSchema = z.object({
  perDose: z.number().positive().max(100).multipleOf(0.25).nullish(),
  timesPerDay: z.number().int().min(1).max(24).nullish(),
  days: z.number().int().min(1).max(365).nullish(),
});
export type DrugRegimen = z.infer<typeof drugRegimenSchema>;

export const prescriptionItemSchema = z
  .object({
    drug: z.string().trim().min(1).max(160),
    dose: z.string().trim().max(80).nullish(),
    frequency: z.string().trim().max(80).nullish(),
    duration: z.string().trim().max(80).nullish(),
    ...drugRegimenSchema.shape,
    note: z.string().trim().max(300).nullish(),
  })
  .refine((item) => (item.duration ?? "") !== "" || item.days != null, {
    path: ["days"],
    message: "A prescription item needs its number of days",
  });
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;

export function readDrugRegimen(meta: Record<string, unknown> | undefined): DrugRegimen {
  const parsed = drugRegimenSchema.safeParse(meta ?? {});

  return parsed.success ? parsed.data : {};
}

export function readDrugNote(meta: Record<string, unknown> | undefined): string {
  const note = meta?.["note"];

  return typeof note === "string" ? note : "";
}

export function regimenShorthand(regimen: DrugRegimen): string | null {
  const parts = [regimen.perDose, regimen.timesPerDay, regimen.days];

  return parts.every((part) => part == null) ? null : parts.map((part) => part ?? "–").join("×");
}

export const prescriptionSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid(),
  visitId: z.uuid().nullable(),
  doctorId: z.uuid(),
  items: z.array(prescriptionItemSchema),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Prescription = z.infer<typeof prescriptionSchema>;

const prescriptionWritableFields = {
  visitId: z.uuid().nullish(),
  doctorId: z.uuid(),
  items: z.array(prescriptionItemSchema).min(1).max(32),
  notes: z.string().trim().max(2000).nullish(),
};

export const createPrescriptionSchema = z.object({
  ...prescriptionWritableFields,
  patientId: z.uuid(),
});
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

export const updatePrescriptionSchema = z
  .object(prescriptionWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;

export const listPrescriptionsQuerySchema = paginationQuerySchema.extend({
  patientId: z.uuid().optional(),
  visitId: z.uuid().optional(),
});
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsQuerySchema>;
