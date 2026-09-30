import {
  PATIENT_KEY,
  PATIENTS_KEY,
  BALANCE_KEY,
  STATEMENT_KEY,
} from "@web/shared/constants/query-keys";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  AllergyFlags,
  Attachment,
  ConfirmAttachmentUploadInput,
  CreatePatientInput,
  CreatePerformedProcedureInput,
  CreatePrescriptionInput,
  CreateVisitInput,
  ListAttachmentsQuery,
  ListTimelineQuery,
  Paginated,
  PatientClinicalView,
  PerformedProcedure,
  Prescription,
  PresignAttachmentUploadInput,
  ProcedureCatalogItem,
  TimelineEntry,
  ToothHistory,
  UpdatePatientInput,
  UpdatePerformedProcedureInput,
  UpdateVisitInput,
  Visit,
} from "@clinic/shared";
import { patientsApi } from "@web/modules/patients/api";
import { uploadToStorage } from "@web/shared/lib/upload";

export const PATIENT_PROCEDURES_KEY = "patient-procedures";
export const PATIENT_ALLERGIES_KEY = "patient-allergies";
export const TOOTH_HISTORY_KEY = "tooth-history";
export const CATALOG_KEY = "procedure-catalog";

export const PATIENT_VISITS_KEY = "patient-visits";
export const PATIENT_PRESCRIPTIONS_KEY = "patient-prescriptions";
export const PATIENT_ATTACHMENTS_KEY = "patient-attachments";
export const PATIENT_TIMELINE_KEY = "patient-timeline";

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdatePatientInput) => patientsApi.update(id, body),
    onSuccess: (patient) => {
      queryClient.setQueryData([PATIENT_KEY, id], patient);
      void queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
    },
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePatientInput) => patientsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] }),
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patientsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] }),
  });
}

export function usePatient(id: string): UseQueryResult<PatientClinicalView> {
  return useQuery({
    queryKey: [PATIENT_KEY, id],
    queryFn: () => patientsApi.get(id),
    enabled: id !== "",
  });
}

export function useAllergyFlags(id: string, enabled = true): UseQueryResult<AllergyFlags> {
  return useQuery({
    queryKey: [PATIENT_ALLERGIES_KEY, id],
    queryFn: () => patientsApi.allergyFlags(id),
    enabled,
  });
}

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

export function useAttachment(id: string, enabled: boolean): UseQueryResult<Attachment> {
  return useQuery({
    queryKey: ["attachment", id],
    queryFn: () => patientsApi.attachment(id),
    enabled,
    staleTime: 60_000,
  });
}

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

    onSettled: () => invalidateClinical(queryClient, patientId),
  });
}

const OPTIMISTIC_PREFIX = "optimistic:";

export const isOptimistic = (id: string): boolean => id.startsWith(OPTIMISTIC_PREFIX);

function optimisticProcedure(
  patientId: string,
  body: CreatePerformedProcedureInput,
): PerformedProcedure {
  const now = new Date().toISOString();

  return {
    id: `${OPTIMISTIC_PREFIX}${now}`,
    clinicId: "",
    patientId,
    visitId: body.visitId ?? null,
    doctorId: body.doctorId,
    procedureId: body.procedureId,
    price: body.price ?? "0.00",
    discount: body.discount,
    discountReason: body.discountReason ?? null,
    status: body.status,
    performedAt: body.performedAt ?? now,
    notes: body.notes ?? null,
    createdAt: now,
    updatedAt: now,
    chartMarks: body.chartMarks.map((mark, index) => ({
      id: `${OPTIMISTIC_PREFIX}${index}`,
      clinicId: "",
      performedProcedureId: `${OPTIMISTIC_PREFIX}${now}`,
      chartType: mark.chartType,
      location: mark.location,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

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

export function usePatientPrescriptions(patientId: string): UseQueryResult<Prescription[]> {
  return useQuery({
    queryKey: [PATIENT_PRESCRIPTIONS_KEY, patientId],
    queryFn: () => patientsApi.prescriptions(patientId),
  });
}

export function useSavePrescription(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: string | undefined; body: CreatePrescriptionInput }) => {
      if (!id) {
        return patientsApi.createPrescription(body);
      }

      const { patientId: _patient, ...changes } = body;

      return patientsApi.updatePrescription(id, changes);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PATIENT_PRESCRIPTIONS_KEY, patientId] });
      void queryClient.invalidateQueries({ queryKey: [PATIENT_TIMELINE_KEY, patientId] });
    },
  });
}

export function useDeletePrescription(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patientsApi.removePrescription(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PATIENT_PRESCRIPTIONS_KEY, patientId] });
      void queryClient.invalidateQueries({ queryKey: [PATIENT_TIMELINE_KEY, patientId] });
    },
  });
}

export function useUpdateProcedure(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePerformedProcedureInput }) =>
      patientsApi.updateProcedure(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData<PerformedProcedure[]>(
        [PATIENT_PROCEDURES_KEY, patientId],
        (current = []) => current.map((row) => (row.id === updated.id ? updated : row)),
      );
      invalidateClinical(queryClient, patientId);
    },
  });
}

function invalidateClinical(queryClient: ReturnType<typeof useQueryClient>, patientId: string) {
  for (const key of [
    PATIENT_VISITS_KEY,
    PATIENT_PROCEDURES_KEY,
    TOOTH_HISTORY_KEY,
    PATIENT_ATTACHMENTS_KEY,
    PATIENT_TIMELINE_KEY,
    BALANCE_KEY,
    STATEMENT_KEY,
  ]) {
    void queryClient.invalidateQueries({ queryKey: [key, patientId] });
  }
}

export function useDeleteProcedure(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patientsApi.removeProcedure(id),
    onSuccess: () => invalidateClinical(queryClient, patientId),
  });
}

export function useDeleteVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patientsApi.removeVisit(id),
    onSuccess: () => invalidateClinical(queryClient, patientId),
  });
}

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
  readonly note?: string | null | undefined;
  readonly visitId?: string | null | undefined;
}

export function useUploadAttachment(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadAttachmentInput): Promise<Attachment> => {
      const presigned = await patientsApi.presignUpload(patientId, {
        filename: input.file.name,
        mime: input.file.type as PresignAttachmentUploadInput["mime"],
        sizeBytes: input.file.size,
      });

      await uploadToStorage(presigned.uploadUrl, input.file);

      const body: ConfirmAttachmentUploadInput = {
        key: presigned.key,
        filename: input.file.name,
        ...(input.note != null && input.note !== "" && { note: input.note }),
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

export function usePatientTimeline(
  patientId: string,
  query: Partial<ListTimelineQuery> = {},
): UseQueryResult<Paginated<TimelineEntry>> {
  return useQuery({
    queryKey: [PATIENT_TIMELINE_KEY, patientId, query],
    queryFn: () => patientsApi.timeline(patientId, query),
    enabled: patientId !== "",
    placeholderData: (previous) => previous,
  });
}
