import type {
  CreatePayrollAdjustmentInput,
  CreateSalaryPaymentInput,
  CreateSettlementPayoutInput,
  DoctorSettlement,
  PayPlan,
  PayPlanInput,
  PayRule,
  PayRules,
  PayRulesInput,
  Payroll,
  PayrollAdjustment,
  SalaryTerm,
  SalaryTermsInput,
  SettlementPayout,
  SettlementQuery,
  SettlementTermsInput,
  StaffPayment,
  UpdateTreatmentSettlementInput,
} from "@clinic/shared";
import { apiDownload, apiRequest } from "@web/shared/lib/api-client";

export const payrollApi = {
  month: (month: string): Promise<Payroll> => apiRequest(`/payroll/${month}`),

  monthPdf: (month: string): Promise<Blob> => apiDownload(`/payroll/${month}/print`),

  sendMonth: (month: string, to: string): Promise<void> =>
    apiRequest(`/payroll/${month}/print/whatsapp`, { method: "POST", body: { to } }),

  salaries: (userId: string): Promise<SalaryTerm[]> => apiRequest(`/payroll/salaries/${userId}`),

  setSalary: (userId: string, body: SalaryTermsInput): Promise<SalaryTerm> =>
    apiRequest(`/payroll/salaries/${userId}`, { method: "PUT", body }),

  payRules: (): Promise<PayRules> => apiRequest("/payroll/pay-rules"),

  setPayRules: (body: PayRulesInput): Promise<PayRule> =>
    apiRequest("/payroll/pay-rules", { method: "PUT", body }),

  plans: (userId: string): Promise<PayPlan[]> => apiRequest(`/payroll/plans/${userId}`),

  setPlan: (userId: string, body: PayPlanInput): Promise<PayPlan> =>
    apiRequest(`/payroll/plans/${userId}`, { method: "PUT", body }),

  adjust: (month: string, body: CreatePayrollAdjustmentInput): Promise<PayrollAdjustment> =>
    apiRequest(`/payroll/${month}/adjustments`, { method: "POST", body }),

  reverseAdjustment: (id: string, reason: string): Promise<PayrollAdjustment> =>
    apiRequest(`/payroll-adjustments/${id}/reverse`, { method: "POST", body: { reason } }),

  pay: (month: string, body: CreateSalaryPaymentInput): Promise<StaffPayment> =>
    apiRequest(`/payroll/${month}/payments`, { method: "POST", body }),

  reversePayment: (id: string, reason: string): Promise<StaffPayment> =>
    apiRequest(`/staff-payments/${id}/reverse`, { method: "POST", body: { reason } }),

  close: (month: string): Promise<Payroll> =>
    apiRequest(`/payroll/${month}/close`, { method: "POST", body: {} }),

  settlement: (doctorId: string, query: SettlementQuery): Promise<DoctorSettlement> =>
    apiRequest(`/doctors/${doctorId}/settlement`, { query }),

  settlementPdf: (doctorId: string, query: SettlementQuery): Promise<Blob> =>
    apiDownload(`/doctors/${doctorId}/settlement/print`, { ...query }),

  sendSettlement: (doctorId: string, query: SettlementQuery, to: string): Promise<void> =>
    apiRequest(`/doctors/${doctorId}/settlement/print/whatsapp`, {
      method: "POST",
      query: { ...query },
      body: { to },
    }),

  setShareTerms: (doctorId: string, body: SettlementTermsInput): Promise<{ id: string }> =>
    apiRequest(`/doctors/${doctorId}/settlement-terms`, { method: "PUT", body }),

  setTreatmentShare: (treatmentId: string, body: UpdateTreatmentSettlementInput): Promise<void> =>
    apiRequest(`/settlement-treatments/${treatmentId}`, { method: "PATCH", body }),

  payout: (doctorId: string, body: CreateSettlementPayoutInput): Promise<SettlementPayout> =>
    apiRequest(`/doctors/${doctorId}/payouts`, { method: "POST", body }),

  payoutPdf: (doctorId: string, payoutId: string): Promise<Blob> =>
    apiDownload(`/doctors/${doctorId}/payouts/${payoutId}/print`, {}),
};
