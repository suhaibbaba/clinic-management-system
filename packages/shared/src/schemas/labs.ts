import { z } from "zod";
import { isFdiTooth } from "@shared/constants/dental";
import {
  LAB_ORDER_SORTS,
  LAB_ORDER_STAGES,
  LAB_ORDER_STATUSES,
  LAB_ORDER_VIEWS,
} from "@shared/enums";
import { isoDateSchema } from "@shared/schemas/appointments";
import {
  hasExactlyOnePatient,
  patientRefFields,
  PATIENT_REF_MESSAGE,
} from "@shared/schemas/patients";
import { personNameSchema } from "@shared/schemas/person-name";
import { paginationQuerySchema, uuidSchema, optionalPhoneSchema } from "@shared/schemas/common";
import { moneySchema, signedMoneySchema, wholeMoneySchema } from "@shared/schemas/money";
import { lookupCodeSchema } from "@shared/schemas/lookups";

export const labSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  contactPerson: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Lab = z.infer<typeof labSchema>;

export const labSummarySchema = labSchema.extend({
  balance: signedMoneySchema,
  openOrders: z.number().int().min(0),
});
export type LabSummary = z.infer<typeof labSummarySchema>;

const labWritableFields = {
  name: z.string().trim().min(2).max(160),
  phone: optionalPhoneSchema,
  address: z.string().trim().max(300).nullish(),
  contactPerson: z.string().trim().max(160).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
};

export const createLabSchema = z.object(labWritableFields);
export type CreateLabInput = z.infer<typeof createLabSchema>;

export const updateLabSchema = createLabSchema.partial();
export type UpdateLabInput = z.infer<typeof updateLabSchema>;

export const listLabsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).optional(),
  includeInactive: z.coerce.boolean().optional(),
});
export type ListLabsQuery = z.infer<typeof listLabsQuerySchema>;

export const labWorkTypeSchema = z.object({
  id: uuidSchema,
  labId: uuidSchema,
  name: z.string(),
  defaultPrice: moneySchema,
  isActive: z.boolean(),
});
export type LabWorkType = z.infer<typeof labWorkTypeSchema>;

export const createLabWorkTypeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  defaultPrice: wholeMoneySchema,
  isActive: z.boolean().optional(),
});
export type CreateLabWorkTypeInput = z.infer<typeof createLabWorkTypeSchema>;

export const updateLabWorkTypeSchema = createLabWorkTypeSchema.partial();
export type UpdateLabWorkTypeInput = z.infer<typeof updateLabWorkTypeSchema>;

export const labTeethSchema = z
  .array(z.number().int().refine(isFdiTooth, "Not a valid FDI tooth number"))
  .max(32);

export const labOrderSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  labId: uuidSchema,
  patientId: uuidSchema,
  doctorId: uuidSchema,
  performedProcedureId: uuidSchema.nullable(),
  workTypeId: uuidSchema.nullable(),
  material: lookupCodeSchema.nullable(),
  shade: lookupCodeSchema.nullable(),
  teeth: labTeethSchema,
  instructions: z.string().nullable(),
  price: moneySchema,
  status: z.enum(LAB_ORDER_STATUSES),
  sentAt: z.iso.datetime().nullable(),
  expectedAt: z.iso.datetime().nullable(),
  receivedAt: z.iso.datetime().nullable(),
  fittedAt: z.iso.datetime().nullable(),
  returnReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LabOrder = z.infer<typeof labOrderSchema>;

export const labOrderRowSchema = labOrderSchema.extend({
  patientName: z.string(),
  patientFileNumber: z.string(),
  doctorName: personNameSchema,
  labName: z.string(),
  workTypeName: z.string().nullable(),
  isOverdue: z.boolean(),
});
export type LabOrderRow = z.infer<typeof labOrderRowSchema>;

const labOrderWritableFields = {
  labId: uuidSchema,
  doctorId: uuidSchema,
  performedProcedureId: uuidSchema.nullish(),
  workTypeId: uuidSchema.nullish(),
  material: lookupCodeSchema.nullish(),
  shade: lookupCodeSchema.nullish(),
  teeth: labTeethSchema.optional(),
  instructions: z.string().trim().max(2000).nullish(),
  price: wholeMoneySchema.optional(),
  expectedAt: isoDateSchema.nullish(),
};

export const createLabOrderSchema = z
  .object({ ...labOrderWritableFields, ...patientRefFields })
  .refine(hasExactlyOnePatient, PATIENT_REF_MESSAGE);
export type CreateLabOrderInput = z.infer<typeof createLabOrderSchema>;

export const updateLabOrderSchema = z
  .object(labOrderWritableFields)
  .omit({ doctorId: true })
  .partial();
export type UpdateLabOrderInput = z.infer<typeof updateLabOrderSchema>;

export const listLabOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LAB_ORDER_STATUSES).optional(),
  labId: uuidSchema.optional(),
  patientId: uuidSchema.optional(),
  doctorId: uuidSchema.optional(),
  overdue: z.coerce.boolean().optional(),
  search: z.string().trim().max(160).optional(),
  view: z.enum(LAB_ORDER_VIEWS).optional(),
  stage: z.enum(LAB_ORDER_STAGES).optional(),
  sort: z.enum(LAB_ORDER_SORTS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  finishedFrom: z.iso.datetime().optional(),
  finishedTo: z.iso.datetime().optional(),
});
export type ListLabOrdersQuery = z.infer<typeof listLabOrdersQuerySchema>;

export const labOrderStageCountsQuerySchema = listLabOrdersQuerySchema.pick({
  labId: true,
  search: true,
});
export type LabOrderStageCountsQuery = z.infer<typeof labOrderStageCountsQuerySchema>;

export const labOrderStageCountsSchema = z.object({
  stages: z.record(z.enum(LAB_ORDER_STAGES), z.number().int().min(0)),
  overdue: z.number().int().min(0),
});
export type LabOrderStageCounts = z.infer<typeof labOrderStageCountsSchema>;

export const returnLabOrderSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type ReturnLabOrderInput = z.infer<typeof returnLabOrderSchema>;

export const labOrderAttachmentSchema = z.object({
  id: uuidSchema,
  labOrderId: uuidSchema,
  filename: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  url: z.string().nullable(),
});
export type LabOrderAttachment = z.infer<typeof labOrderAttachmentSchema>;

export const presignLabAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(3).max(160),
});
export type PresignLabAttachmentInput = z.infer<typeof presignLabAttachmentSchema>;

export const confirmLabAttachmentSchema = z.object({
  key: z.string().trim().min(1).max(512),
  filename: z.string().trim().min(1).max(255),
});
export type ConfirmLabAttachmentInput = z.infer<typeof confirmLabAttachmentSchema>;

export const labPaymentSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  labId: uuidSchema,
  amount: signedMoneySchema,
  method: lookupCodeSchema,
  note: z.string().nullable(),
  reversesId: uuidSchema.nullable(),
  paidBy: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type LabPayment = z.infer<typeof labPaymentSchema>;

export const createLabPaymentSchema = z.object({
  labId: uuidSchema,
  amount: wholeMoneySchema.refine(
    (value) => Number(value) > 0,
    "A payment must be greater than zero",
  ),
  method: lookupCodeSchema,
  note: z.string().trim().max(500).nullish(),
});
export type CreateLabPaymentInput = z.infer<typeof createLabPaymentSchema>;

export const reverseLabPaymentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type ReverseLabPaymentInput = z.infer<typeof reverseLabPaymentSchema>;

export const labBalanceSchema = z.object({
  labId: uuidSchema,
  owed: signedMoneySchema,
  paid: signedMoneySchema,
  balance: signedMoneySchema,
  lastPaymentAt: z.iso.datetime().nullable(),
});
export type LabBalance = z.infer<typeof labBalanceSchema>;

export const LAB_STATEMENT_ENTRY_KIND = {
  ORDER: "order",
  PAYMENT: "payment",
} as const;
export type LabStatementEntryKind =
  (typeof LAB_STATEMENT_ENTRY_KIND)[keyof typeof LAB_STATEMENT_ENTRY_KIND];

export const labStatementEntrySchema = z.object({
  id: uuidSchema,
  kind: z.enum([LAB_STATEMENT_ENTRY_KIND.ORDER, LAB_STATEMENT_ENTRY_KIND.PAYMENT]),
  occurredAt: z.iso.datetime(),
  description: z.string(),
  amount: signedMoneySchema,
  runningBalance: signedMoneySchema,
  isReversal: z.boolean(),
});
export type LabStatementEntry = z.infer<typeof labStatementEntrySchema>;

export const labStatementSchema = z.object({
  labId: uuidSchema,
  labName: z.string(),
  from: z.iso.datetime().nullable(),
  to: z.iso.datetime().nullable(),
  openingBalance: signedMoneySchema,
  closingBalance: signedMoneySchema,
  entries: z.array(labStatementEntrySchema),
});
export type LabStatement = z.infer<typeof labStatementSchema>;
