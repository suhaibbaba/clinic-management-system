import { listDoctors } from "@web/shared/api/doctors";
import type {
  CreateDoctorInput,
  CreateSettlementPayoutInput,
  CreateVisitingDoctorInput,
  Doctor,
  DoctorSettlement,
  SettlementPayout,
  StaffPayment,
  SettlementQuery,
  SettlementTermsInput,
  UpdateTreatmentSettlementInput,
  UpdateDoctorInput,
  UpdateDoctorScheduleInput,
} from "@clinic/shared";
import { apiDownload, apiRequest } from "@web/shared/lib/api-client";

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

  settlementPdf: (id: string, query: SettlementQuery): Promise<Blob> =>
    apiDownload(`/doctors/${id}/settlement/print`, { ...query }),

  sendSettlement: (id: string, query: SettlementQuery, to: string): Promise<void> =>
    apiRequest(`/doctors/${id}/settlement/print/whatsapp`, {
      method: "POST",
      query: { ...query },
      body: { to },
    }),

  setTerms: (id: string, body: SettlementTermsInput): Promise<{ id: string }> =>
    apiRequest(`/doctors/${id}/settlement-terms`, { method: "PUT", body }),

  setTreatment: (treatmentId: string, body: UpdateTreatmentSettlementInput): Promise<void> =>
    apiRequest(`/settlement-treatments/${treatmentId}`, { method: "PATCH", body }),

  payout: (id: string, body: CreateSettlementPayoutInput): Promise<SettlementPayout> =>
    apiRequest(`/doctors/${id}/payouts`, { method: "POST", body }),

  payoutPdf: (id: string, payoutId: string): Promise<Blob> =>
    apiDownload(`/doctors/${id}/payouts/${payoutId}/print`, {}),

  reversePayment: (paymentId: string, reason: string): Promise<StaffPayment> =>
    apiRequest(`/staff-payments/${paymentId}/reverse`, { method: "POST", body: { reason } }),
};
