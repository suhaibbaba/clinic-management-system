import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  AllergyFlags,
  Attachment,
  CreatePerformedProcedureInput,
  PatientClinicalView,
  PerformedProcedure,
  ProcedureCatalogItem,
  ToothHistory,
} from '@clinic/shared';

import { patientsApi } from '@web/features/patients/api';

export const PATIENT_KEY = 'patient';
export const PATIENT_PROCEDURES_KEY = 'patient-procedures';
export const PATIENT_ALLERGIES_KEY = 'patient-allergies';
export const TOOTH_HISTORY_KEY = 'tooth-history';
export const CATALOG_KEY = 'procedure-catalog';

export function usePatient(id: string): UseQueryResult<PatientClinicalView> {
  return useQuery({ queryKey: [PATIENT_KEY, id], queryFn: () => patientsApi.get(id) });
}

export function useAllergyFlags(id: string): UseQueryResult<AllergyFlags> {
  return useQuery({
    queryKey: [PATIENT_ALLERGIES_KEY, id],
    queryFn: () => patientsApi.allergyFlags(id),
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
