import type {
  CreatePayrollAdjustmentInput,
  CreateSalaryPaymentInput,
  Payroll,
  PayrollAdjustment,
  SalaryTerm,
  SalaryTermsInput,
  StaffPayment,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const payrollApi = {
  month: (month: string): Promise<Payroll> => apiRequest(`/payroll/${month}`),

  salaries: (userId: string): Promise<SalaryTerm[]> => apiRequest(`/payroll/salaries/${userId}`),

  setSalary: (userId: string, body: SalaryTermsInput): Promise<SalaryTerm> =>
    apiRequest(`/payroll/salaries/${userId}`, { method: "PUT", body }),

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
};
