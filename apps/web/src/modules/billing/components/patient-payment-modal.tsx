import type { JSX } from "react";
import { PaymentModal } from "@web/modules/billing/components/payment-modal";
import { usePatientBalance } from "@web/modules/billing/queries";

export interface PatientPaymentModalProps {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly patientId: string;
  readonly currency?: string | undefined;
}

export function PatientPaymentModal({
  open,
  onOpenChange,
  patientId,
  currency,
  "data-testid": testId,
}: PatientPaymentModalProps): JSX.Element {
  const balance = usePatientBalance(patientId, open);

  return (
    <PaymentModal
      data-testid={testId}
      open={open && balance.data !== undefined}
      onOpenChange={onOpenChange}
      patientId={patientId}
      balance={balance.data?.balance}
      currency={currency}
    />
  );
}
