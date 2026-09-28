import { type Money, type OverduePatient, formatMinorUnits, toMinorUnits } from "@clinic/shared";

export interface OverdueTotal {
  readonly total: Money;
  readonly patients: number;
}

export interface OverdueRow extends Record<string, unknown> {
  readonly patient_id: string;
  readonly file_number: string;
  readonly full_name: string;
  readonly phone: string;
  readonly balance: string;
  readonly last_payment_at: Date | string | null;
  readonly total: number;
}

export function toOverduePatient(row: OverdueRow): OverduePatient {
  const lastPaymentAt = row.last_payment_at ? new Date(row.last_payment_at) : null;

  return {
    patientId: row.patient_id,
    fileNumber: row.file_number,
    fullName: row.full_name,
    phone: row.phone,
    balance: formatMinorUnits(toMinorUnits(row.balance)),
    lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : null,
    daysSinceLastPayment: lastPaymentAt
      ? Math.floor((Date.now() - lastPaymentAt.getTime()) / 86_400_000)
      : null,
  };
}
