import { DOCTORS_KEY } from "@web/shared/constants/query-keys";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  CreateDoctorInput,
  CreateStaffPaymentInput,
  CreateVisitingDoctorInput,
  Doctor,
  DoctorSettlement,
  SettlementQuery,
  UpdateTreatmentSettlementInput,
  Paginated,
  Specialty,
  UpdateDoctorInput,
  WeeklySchedule,
} from "@clinic/shared";
import { doctorsApi } from "@web/modules/doctors/api";

const SPECIALTIES_KEY = "specialties";
const SETTLEMENT_KEY = "doctor-settlement";

export function useDoctor(id: string | undefined): UseQueryResult<Doctor> {
  return useQuery({
    queryKey: [DOCTORS_KEY, "one", id],
    queryFn: () => doctorsApi.get(id ?? ""),
    enabled: id !== undefined,
  });
}

export function useSpecialties(): UseQueryResult<Paginated<Specialty>> {
  return useQuery({ queryKey: [SPECIALTIES_KEY], queryFn: () => doctorsApi.specialties() });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateDoctorInput) => doctorsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] }),
  });
}

export function useCreateVisitingDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateVisitingDoctorInput) => doctorsApi.createVisiting(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] }),
  });
}

export function useUpdateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateDoctorInput }) =>
      doctorsApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] }),
  });
}

export function useUpdateDoctorSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, weeklySchedule }: { id: string; weeklySchedule: WeeklySchedule }) =>
      doctorsApi.updateSchedule(id, { weeklySchedule }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] }),
  });
}

export function useSettlement(
  id: string,
  query: SettlementQuery,
  enabled: boolean,
): UseQueryResult<DoctorSettlement> {
  return useQuery({
    queryKey: [SETTLEMENT_KEY, id, query.from, query.to],
    queryFn: () => doctorsApi.settlement(id, query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

function useSettlementWrite<TInput>(id: string, write: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: write,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SETTLEMENT_KEY, id] }),
  });
}

export const useSetSettlementTerms = (id: string) =>
  useSettlementWrite(id, (clinicSharePercent: number) =>
    doctorsApi.setTerms(id, { clinicSharePercent }),
  );

export const useSetTreatmentSettlement = (id: string) =>
  useSettlementWrite(
    id,
    ({ treatmentId, body }: { treatmentId: string; body: UpdateTreatmentSettlementInput }) =>
      doctorsApi.setTreatment(treatmentId, body),
  );

export const useRecordPayout = (id: string) =>
  useSettlementWrite(id, (body: CreateStaffPaymentInput) => doctorsApi.payout(id, body));

export const useReversePayout = (id: string) =>
  useSettlementWrite(id, ({ payoutId, reason }: { payoutId: string; reason: string }) =>
    doctorsApi.reversePayment(payoutId, reason),
  );
