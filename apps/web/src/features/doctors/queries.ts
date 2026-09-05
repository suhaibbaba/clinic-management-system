import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreateDoctorInput,
  Doctor,
  ListDoctorsQuery,
  Paginated,
  Specialty,
  UpdateDoctorInput,
  WeeklySchedule,
} from '@clinic/shared';

import { doctorsApi } from '@web/features/doctors/api';

const DOCTORS_KEY = 'doctors';
const SPECIALTIES_KEY = 'specialties';

export function useDoctors(query: Partial<ListDoctorsQuery>): UseQueryResult<Paginated<Doctor>> {
  return useQuery({
    queryKey: [DOCTORS_KEY, query],
    queryFn: () => doctorsApi.list(query),
    placeholderData: (previous) => previous,
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
