import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  AllergyFlags,
  Attachment,
  ConfirmAttachmentUploadInput,
  CreatePatientInput,
  CreatePerformedProcedureInput,
  CreateTreatmentPlanInput,
  CreateTreatmentPlanItemInput,
  CreateVisitInput,
  ListAttachmentsQuery,
  ListPatientsQuery,
  Paginated,
  PatientClinicalView,
  PatientView,
  PerformedProcedure,
  PresignAttachmentUploadInput,
  ProcedureCatalogItem,
  ToothHistory,
  TreatmentPlan,
  UpdatePerformedProcedureInput,
  UpdateTreatmentPlanItemInput,
  UpdateVisitInput,
  Visit,
} from '@clinic/shared';

import { patientsApi, uploadToStorage } from '@web/features/patients/api';

export const PATIENT_KEY = 'patient';
export const PATIENT_PROCEDURES_KEY = 'patient-procedures';
export const PATIENT_ALLERGIES_KEY = 'patient-allergies';
export const TOOTH_HISTORY_KEY = 'tooth-history';
export const CATALOG_KEY = 'procedure-catalog';
export const PATIENTS_KEY = 'patients';
export const PATIENT_VISITS_KEY = 'patient-visits';
export const PATIENT_PLANS_KEY = 'patient-treatment-plans';
export const PATIENT_ATTACHMENTS_KEY = 'patient-attachments';

export function usePatients(
  query: Partial<ListPatientsQuery>,
): UseQueryResult<Paginated<PatientView>> {
  return useQuery({
    queryKey: [PATIENTS_KEY, query],
    queryFn: () => patientsApi.list(query),
    // Keeps the previous page on screen while a new search is in flight, so the
    // table does not blink empty on every keystroke that survives the debounce.
    placeholderData: (previous) => previous,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePatientInput) => patientsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] }),
  });
}

export function usePatient(id: string): UseQueryResult<PatientClinicalView> {
  return useQuery({
    queryKey: [PATIENT_KEY, id],
    queryFn: () => patientsApi.get(id),
    // `GET /patients/` is a 400, every time. A component that has no id yet is
    // mid-render, not in error, so it should not be firing a doomed request.
    enabled: id !== '',
  });
}

export function useAllergyFlags(id: string, enabled = true): UseQueryResult<AllergyFlags> {
  return useQuery({
    queryKey: [PATIENT_ALLERGIES_KEY, id],
    queryFn: () => patientsApi.allergyFlags(id),
    enabled,
  });
}

/** Backs the whole chart: every procedure, each with the teeth it touched. */
export function usePatientProcedures(id: string): UseQueryResult<PerformedProcedure[]> {
  return useQuery({
    queryKey: [PATIENT_PROCEDURES_KEY, id],
    queryFn: () => patientsApi.procedures(id),
  });
}

export function useProcedureCatalog(): UseQueryResult<ProcedureCatalogItem[]> {
  return useQuery({ queryKey: [CATALOG_KEY], queryFn: () => patientsApi.catalog() });
}

export function useToothHistory(
  patientId: string,
  fdi: number | null,
): UseQueryResult<ToothHistory> {
  return useQuery({
    queryKey: [TOOTH_HISTORY_KEY, patientId, fdi],
    queryFn: () => patientsApi.toothHistory(patientId, fdi as number),
    enabled: fdi !== null,
  });
}

/** One signed URL per attachment, fetched only when the panel shows it. */
export function useAttachment(id: string, enabled: boolean): UseQueryResult<Attachment> {
  return useQuery({
    queryKey: ['attachment', id],
    queryFn: () => patientsApi.attachment(id),
    enabled,
    // Signed URLs expire; refetching on mount is cheaper than serving a dead one.
    staleTime: 60_000,
  });
}

/**
 * Records a procedure and recolours the chart before the server answers.
 *
 * The optimistic entry is a real `PerformedProcedure` shape written into the
 * procedures cache, so the same derivation that colours the chart from server
 * data colours it from this — there is no second, "pending" code path. On
 * failure the previous cache is put back, so a rejected write never leaves a
 * tooth showing treatment it did not receive.
 */
export function useCreateProcedure(patientId: string) {
  const queryClient = useQueryClient();
  const key = [PATIENT_PROCEDURES_KEY, patientId];

  return useMutation({
    mutationFn: (body: CreatePerformedProcedureInput) => patientsApi.createProcedure(body),

    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PerformedProcedure[]>(key);

      queryClient.setQueryData<PerformedProcedure[]>(key, (current = []) => [
        ...current,
        optimisticProcedure(patientId, body),
      ]);

      return { previous };
    },

    onError: (_error, _body, context) => {
      queryClient.setQueryData(key, context?.previous);
    },

    // Settled, not success: a failed write still has to reconcile with the
    // server, in case it landed and the response was what was lost.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: [TOOTH_HISTORY_KEY, patientId] });
    },
  });
}

/** Placeholder id: replaced by the server's row as soon as the write settles. */
const OPTIMISTIC_PREFIX = 'optimistic:';

export const isOptimistic = (id: string): boolean => id.startsWith(OPTIMISTIC_PREFIX);

function optimisticProcedure(
  patientId: string,
  body: CreatePerformedProcedureInput,
): PerformedProcedure {
  const now = new Date().toISOString();

  return {
    id: `${OPTIMISTIC_PREFIX}${now}`,
    clinicId: '',
    patientId,
    visitId: body.visitId ?? null,
    doctorId: body.doctorId,
    procedureId: body.procedureId,
    price: body.price ?? '0.00',
    discount: body.discount,
    discountReason: body.discountReason ?? null,
    status: body.status,
    planItemId: null,
    performedAt: body.performedAt ?? now,
    notes: body.notes ?? null,
    createdAt: now,
    updatedAt: now,
    chartMarks: body.chartMarks.map((mark, index) => ({
      id: `${OPTIMISTIC_PREFIX}${index}`,
      clinicId: '',
      performedProcedureId: `${OPTIMISTIC_PREFIX}${now}`,
      chartType: mark.chartType,
      location: mark.location,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Visits                                                                      */
/* -------------------------------------------------------------------------- */

export function usePatientVisits(patientId: string): UseQueryResult<Visit[]> {
  return useQuery({
    queryKey: [PATIENT_VISITS_KEY, patientId],
    queryFn: () => patientsApi.visits(patientId),
  });
}

export function useSaveVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: string | undefined; body: CreateVisitInput }) =>
      id ? patientsApi.updateVisit(id, body as UpdateVisitInput) : patientsApi.createVisit(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PATIENT_VISITS_KEY, patientId] }),
  });
}

/**
 * Editing a procedure recorded inside a visit.
 *
 * Invalidates the chart's cache too: a price or a status change moves the tooth
 * it was recorded on, and the chart must not keep showing the old one.
 */
export function useUpdateProcedure(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePerformedProcedureInput }) =>
      patientsApi.updateProcedure(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PATIENT_PROCEDURES_KEY, patientId] });
      void queryClient.invalidateQueries({ queryKey: [TOOTH_HISTORY_KEY, patientId] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Treatment plans                                                             */
/* -------------------------------------------------------------------------- */

export function useTreatmentPlans(patientId: string): UseQueryResult<TreatmentPlan[]> {
  return useQuery({
    queryKey: [PATIENT_PLANS_KEY, patientId],
    queryFn: () => patientsApi.treatmentPlans(patientId),
  });
}

export function useCreateTreatmentPlan(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTreatmentPlanInput) => patientsApi.createTreatmentPlan(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PATIENT_PLANS_KEY, patientId] }),
  });
}

export function useAddPlanItem(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, body }: { planId: string; body: CreateTreatmentPlanItemInput }) =>
      patientsApi.addPlanItem(planId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PATIENT_PLANS_KEY, patientId] }),
  });
}

export function useUpdatePlanItem(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: UpdateTreatmentPlanItemInput }) =>
      patientsApi.updatePlanItem(itemId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PATIENT_PLANS_KEY, patientId] }),
  });
}

/**
 * `POST /plan-items/:id/convert`.
 *
 * The item becomes a performed procedure, so both the plan and everything the
 * new procedure feeds — the chart, the tooth history — are refetched.
 */
export function useConvertPlanItem(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => patientsApi.convertPlanItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PATIENT_PLANS_KEY, patientId] });
      void queryClient.invalidateQueries({ queryKey: [PATIENT_PROCEDURES_KEY, patientId] });
      void queryClient.invalidateQueries({ queryKey: [TOOTH_HISTORY_KEY, patientId] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Attachments                                                                 */
/* -------------------------------------------------------------------------- */

export function usePatientAttachments(
  patientId: string,
  query: Partial<ListAttachmentsQuery> = {},
): UseQueryResult<Attachment[]> {
  return useQuery({
    queryKey: [PATIENT_ATTACHMENTS_KEY, patientId, query],
    queryFn: () => patientsApi.attachments(patientId, query),
    placeholderData: (previous) => previous,
  });
}

export interface UploadAttachmentInput {
  readonly file: File;
  readonly type: PresignAttachmentUploadInput['type'];
  readonly tooth?: number | null | undefined;
  readonly note?: string | null | undefined;
  readonly visitId?: string | null | undefined;
}

/**
 * The three-step upload: presign, PUT straight to storage, confirm.
 *
 * Bytes never pass through the API. The key comes back from the presign step
 * and is echoed to confirm untouched — the client never builds one, and the
 * API re-reads the real size and content type from the bucket rather than
 * trusting anything sent here.
 */
export function useUploadAttachment(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadAttachmentInput): Promise<Attachment> => {
      const presigned = await patientsApi.presignUpload(patientId, {
        filename: input.file.name,
        mime: input.file.type as PresignAttachmentUploadInput['mime'],
        sizeBytes: input.file.size,
        type: input.type,
      });

      await uploadToStorage(presigned.uploadUrl, input.file);

      const body: ConfirmAttachmentUploadInput = {
        key: presigned.key,
        filename: input.file.name,
        type: input.type,
        ...(input.tooth != null && { tooth: input.tooth }),
        ...(input.note != null && input.note !== '' && { note: input.note }),
        ...(input.visitId != null && { visitId: input.visitId }),
      };

      return patientsApi.confirmUpload(patientId, body);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [PATIENT_ATTACHMENTS_KEY, patientId] }),
  });
}

export function useDeleteAttachment(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patientsApi.deleteAttachment(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [PATIENT_ATTACHMENTS_KEY, patientId] }),
  });
}
