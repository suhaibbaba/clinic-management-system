import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Widget, type IconName } from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { useDoctors } from "@web/shared/queries/doctors";
import { canCreatePatient, canRecordVisit } from "@web/shared/permissions/patients";
import { canRecordPayment } from "@web/shared/permissions/billing";
import { PatientFormModal } from "@web/modules/patients/components/patient-form-modal";
import { VisitFormModal } from "@web/modules/patients/components/visits/visit-form-modal";
import { PatientPaymentModal } from "@web/modules/billing/components/patient-payment-modal";
import { ChoosePatientModal } from "@web/modules/dashboard/components/choose-patient-modal";

type Action = "patient" | "visit" | "payment";

interface Step {
  readonly action: Action;
  readonly patientId: string | null;
}

export function QuickActions({ currency }: { readonly currency: string | undefined }): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step | null>(null);
  const doctors = useDoctors({ limit: 100 });

  const actions: readonly {
    readonly id: Action;
    readonly icon: IconName;
    readonly show: boolean;
  }[] = [
    { id: "patient", icon: "user-plus", show: canCreatePatient(can) },
    { id: "visit", icon: "stethoscope", show: canRecordVisit(can) },
    { id: "payment", icon: "coins", show: canRecordPayment(can) },
  ];

  const close = (open: boolean): void => {
    if (!open) {
      setStep(null);
    }
  };

  return (
    <Widget data-testid="dashboard-quick-actions" title={t("dashboard.widgets.quickActions.title")}>
      <div className="mt-3 flex flex-col gap-2">
        {actions
          .filter((action) => action.show)
          .map((action) => (
            <Button
              key={action.id}
              variant={action.id === "patient" ? "primary" : "secondary"}
              data-testid={`dashboard-quick-${action.id}`}
              icon={<Icon name={action.icon} />}
              className="justify-start"
              onClick={() => setStep({ action: action.id, patientId: null })}
            >
              {t(`dashboard.quick.${action.id}`)}
            </Button>
          ))}
      </div>

      <PatientFormModal
        data-testid="dashboard-quick-patient-modal"
        open={step?.action === "patient"}
        onOpenChange={close}
        onCreated={(patientId) => {
          setStep(null);
          navigate(`/patients/${patientId}`);
        }}
      />

      <ChoosePatientModal
        data-testid="dashboard-quick-choose"
        open={step !== null && step.action !== "patient" && step.patientId === null}
        title={step?.action === "payment" ? "dashboard.quick.payment" : "dashboard.quick.visit"}
        onOpenChange={close}
        onChosen={(patientId) => setStep((current) => current && { ...current, patientId })}
      />

      {step?.action === "visit" && step.patientId !== null && (
        <VisitFormModal
          data-testid="dashboard-quick-visit-modal"
          open
          onOpenChange={close}
          patientId={step.patientId}
          doctors={doctors.data?.items ?? []}
          visit={null}
        />
      )}

      {step?.action === "payment" && step.patientId !== null && (
        <PatientPaymentModal
          data-testid="dashboard-quick-payment-modal"
          open
          onOpenChange={close}
          patientId={step.patientId}
          currency={currency}
        />
      )}
    </Widget>
  );
}
