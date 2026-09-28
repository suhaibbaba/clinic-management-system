import { DOCTORS_KEY } from "@web/shared/constants/query-keys";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  CreateDoctorInput,
  CreateVisitingDoctorInput,
  Doctor,
  Paginated,
  Specialty,
  UpdateDoctorInput,
  WeeklySchedule,
} from "@clinic/shared";
import { doctorsApi } from "@web/modules/doctors/api";

const SPECIALTIES_KEY = "specialties";

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
