import { listDoctors } from "@web/shared/api/doctors";
import type {
  CreateDoctorInput,
  CreateStaffPaymentInput,
  CreateVisitingDoctorInput,
  Doctor,
  DoctorSettlement,
  StaffPayment,
  SettlementQuery,
  SettlementTermsInput,
  UpdateTreatmentSettlementInput,
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

  remove: (id: string): Promise<void> => apiRequest(`/doctors/${id}`, { method: "DELETE" }),

  updateSchedule: (id: string, body: UpdateDoctorScheduleInput): Promise<Doctor> =>
    apiRequest(`/doctors/${id}/schedule`, { method: "PATCH", body }),

  settlement: (id: string, query: SettlementQuery): Promise<DoctorSettlement> =>
    apiRequest(`/doctors/${id}/settlement`, { query }),

  setTerms: (id: string, body: SettlementTermsInput): Promise<void> =>
    apiRequest(`/doctors/${id}/settlement-terms`, { method: "PUT", body }),

  setTreatment: (treatmentId: string, body: UpdateTreatmentSettlementInput): Promise<void> =>
    apiRequest(`/settlement-treatments/${treatmentId}`, { method: "PATCH", body }),

  payout: (id: string, body: CreateStaffPaymentInput): Promise<StaffPayment> =>
    apiRequest(`/doctors/${id}/payouts`, { method: "POST", body }),

  reversePayment: (paymentId: string, reason: string): Promise<StaffPayment> =>
    apiRequest(`/staff-payments/${paymentId}/reverse`, { method: "POST", body: { reason } }),

  specialties: (): Promise<Paginated<Specialty>> =>
    apiRequest("/specialties", { query: { limit: 100 } }),
};
