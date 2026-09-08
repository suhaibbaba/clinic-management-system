import {
  SCHEDULE_CONFLICT_ERROR,
  type ClinicClosure,
  type ClinicClosureResult,
  type ConflictingAppointment,
  type CreateClinicClosureInput,
  type CreateDoctorTimeOffInput,
  type DoctorTimeOff,
  type DoctorTimeOffResult,
  type ListClinicClosuresQuery,
  type ListDoctorTimeOffQuery,
  type Paginated,
  type ScheduleConflictOptions,
} from '@clinic/shared';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

// Imported rather than retyped: a key that drifts here leaves the grid showing
// an open Tuesday the settings screen has just closed, and nothing fails
// loudly enough for anyone to notice.
import { AVAILABILITY_KEY, CALENDAR_KEY } from '@web/features/appointments/queries';
import { closuresApi, timeOffApi } from '@web/features/schedule/api';
import { ApiError } from '@web/lib/api-error';

const CLOSURES_KEY = 'clinic-closures';
const TIME_OFF_KEY = 'doctor-time-off';

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
    queryFn: () => timeOffApi.list(doctorId ?? '', query),
    enabled: doctorId !== undefined,
    placeholderData: (previous) => previous,
  });
}

/**
 * Every list that a closure or an absence can change.
 *
 * The calendar and the availability endpoint both compute from these rows, so
 * shutting the clinic for Eid has to leave a stale grid behind it — which is
 * exactly the state in which somebody books into a closed day.
 */
function useInvalidateSchedule(): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all(
      [CLOSURES_KEY, TIME_OFF_KEY, CALENDAR_KEY, AVAILABILITY_KEY].map((key) =>
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

/**
 * The appointments a refused write would have stranded, or null for any other
 * failure.
 *
 * Matched on the `error` code rather than on the status: a 409 is also what a
 * double booking and a duplicate phone number answer with, and a dialog listing
 * patients is a very wrong thing to show for either.
 */
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
