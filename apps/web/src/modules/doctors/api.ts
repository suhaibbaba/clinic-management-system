import { listDoctors } from "@web/shared/api/doctors";
import type {
  CreateDoctorInput,
  CreateVisitingDoctorInput,
  Doctor,
  Paginated,
  Specialty,
  UpdateDoctorInput,
  UpdateDoctorScheduleInput,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const doctorsApi = {
  list: listDoctors,

  get: (id: string): Promise<Doctor> => apiRequest(`/doctors/${id}`),

  create: (body: CreateDoctorInput): Promise<Doctor> =>
    apiRequest("/doctors", { method: "POST", body }),

  createVisiting: (body: CreateVisitingDoctorInput): Promise<Doctor> =>
    apiRequest("/doctors/visiting", { method: "POST", body }),

  update: (id: string, body: UpdateDoctorInput): Promise<Doctor> =>
    apiRequest(`/doctors/${id}`, { method: "PATCH", body }),

  updateSchedule: (id: string, body: UpdateDoctorScheduleInput): Promise<Doctor> =>
    apiRequest(`/doctors/${id}/schedule`, { method: "PATCH", body }),

  specialties: (): Promise<Paginated<Specialty>> =>
    apiRequest("/specialties", { query: { limit: 100 } }),
};
