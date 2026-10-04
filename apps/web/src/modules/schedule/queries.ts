import {
  SCHEDULE_CONFLICT_ERROR,
  type ClinicClosure,
  type ClinicClosureResult,
  type ConflictingAppointment,
  type CreateClinicClosureInput,
  type CreateDoctorExtraHoursInput,
  type CreateDoctorTimeOffInput,
  type DoctorExtraHours,
  type DoctorTimeOff,
  type DoctorTimeOffResult,
  type ListClinicClosuresQuery,
  type ListDoctorExtraHoursQuery,
  type ListDoctorTimeOffQuery,
  type Paginated,
  type ScheduleConflictOptions,
} from "@clinic/shared";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { AVAILABILITY_KEY, CALENDAR_KEY } from "@web/shared/constants/query-keys";
import { closuresApi, extraHoursApi, timeOffApi } from "@web/modules/schedule/api";
import { ApiError } from "@web/shared/lib/api-error";

const CLOSURES_KEY = "clinic-closures";
const TIME_OFF_KEY = "doctor-time-off";
const EXTRA_HOURS_KEY = "doctor-extra-hours";

export function useClinicClosures(
  query: Partial<ListClinicClosuresQuery> = {},
): UseQueryResult<Paginated<ClinicClosure>> {
  return useQuery({
    queryKey: [CLOSURES_KEY, query],
    queryFn: () => closuresApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useDoctorTimeOff(
  doctorId: string | undefined,
  query: Partial<ListDoctorTimeOffQuery> = {},
): UseQueryResult<Paginated<DoctorTimeOff>> {
  return useQuery({
    queryKey: [TIME_OFF_KEY, doctorId, query],
    queryFn: () => timeOffApi.list(doctorId ?? "", query),
    enabled: doctorId !== undefined,
    placeholderData: (previous) => previous,
  });
}

function useInvalidateSchedule(): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all(
      [CLOSURES_KEY, TIME_OFF_KEY, EXTRA_HOURS_KEY, CALENDAR_KEY, AVAILABILITY_KEY].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
}

export function useCreateClosure() {
  const invalidate = useInvalidateSchedule();

  return useMutation({
    mutationFn: ({
      body,
      choice,
    }: {
      body: CreateClinicClosureInput;
      choice?: Partial<ScheduleConflictOptions>;
    }): Promise<ClinicClosureResult> => closuresApi.create(body, choice),
    onSuccess: invalidate,
  });
}

export function useDeleteClosure() {
  const invalidate = useInvalidateSchedule();

  return useMutation({
    mutationFn: (id: string) => closuresApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useCreateTimeOff() {
  const invalidate = useInvalidateSchedule();

  return useMutation({
    mutationFn: ({
      doctorId,
      body,
      choice,
    }: {
      doctorId: string;
      body: CreateDoctorTimeOffInput;
      choice?: Partial<ScheduleConflictOptions>;
    }): Promise<DoctorTimeOffResult> => timeOffApi.create(doctorId, body, choice),
    onSuccess: invalidate,
  });
}

export function useDeleteTimeOff() {
  const invalidate = useInvalidateSchedule();

  return useMutation({
    mutationFn: (id: string) => timeOffApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useDoctorExtraHours(
  doctorId: string | undefined,
  query: Partial<ListDoctorExtraHoursQuery> = {},
): UseQueryResult<Paginated<DoctorExtraHours>> {
  return useQuery({
    queryKey: [EXTRA_HOURS_KEY, doctorId, query],
    queryFn: () => extraHoursApi.list(doctorId ?? "", query),
    enabled: doctorId !== undefined,
    placeholderData: (previous) => previous,
  });
}

export function useCreateExtraHours() {
  const invalidate = useInvalidateSchedule();

  return useMutation({
    mutationFn: ({ doctorId, body }: { doctorId: string; body: CreateDoctorExtraHoursInput }) =>
      extraHoursApi.create(doctorId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteExtraHours() {
  const invalidate = useInvalidateSchedule();

  return useMutation({
    mutationFn: (id: string) => extraHoursApi.remove(id),
    onSuccess: invalidate,
  });
}

export function scheduleConflicts(error: unknown): ConflictingAppointment[] | null {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return null;
  }

  const payload = error.payload as { error?: unknown; appointments?: unknown } | null | undefined;

  if (payload?.error !== SCHEDULE_CONFLICT_ERROR || !Array.isArray(payload.appointments)) {
    return null;
  }

  return payload.appointments as ConflictingAppointment[];
}
