import { DASHBOARD_QUICK_ACTION, type DashboardQuickAction } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Widget, type IconName } from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { useDoctors } from "@web/shared/queries/doctors";
import { canCreatePatient, canRecordVisit } from "@web/shared/permissions/patients";
import { canRecordPayment } from "@web/shared/permissions/billing";
import { canBookAppointment } from "@web/shared/permissions/appointments";
import { AppointmentFormModal } from "@web/modules/appointments/components/appointment-form-modal";
import { PatientFormModal } from "@web/modules/patients/components/patient-form-modal";
import { VisitFormModal } from "@web/modules/patients/components/visits/visit-form-modal";
import { PatientPaymentModal } from "@web/modules/billing/components/patient-payment-modal";
import { ChoosePatientModal } from "@web/modules/dashboard/components/choose-patient-modal";

interface Step {
  readonly action: DashboardQuickAction;
  readonly patientId: string | null;
}

export interface QuickActionsProps {
  readonly shown: readonly DashboardQuickAction[];
  readonly currency: string | undefined;
}

const ACTION_ICON: Readonly<Record<DashboardQuickAction, IconName>> = {
  [DASHBOARD_QUICK_ACTION.PATIENT]: "user-plus",
  [DASHBOARD_QUICK_ACTION.APPOINTMENT]: "calendar",
  [DASHBOARD_QUICK_ACTION.VISIT]: "stethoscope",
  [DASHBOARD_QUICK_ACTION.PAYMENT]: "coins",
};

export function QuickActions({ shown, currency }: QuickActionsProps): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step | null>(null);
  const doctors = useDoctors({ limit: 100 });

  const allowed: Readonly<Record<DashboardQuickAction, boolean>> = {
    [DASHBOARD_QUICK_ACTION.PATIENT]: canCreatePatient(can),
    [DASHBOARD_QUICK_ACTION.APPOINTMENT]: canBookAppointment(can),
    [DASHBOARD_QUICK_ACTION.VISIT]: canRecordVisit(can),
    [DASHBOARD_QUICK_ACTION.PAYMENT]: canRecordPayment(can),
  };
  const actions = shown.filter((action) => allowed[action]);
  const choosesPatient = (action: DashboardQuickAction): boolean =>
    action === DASHBOARD_QUICK_ACTION.VISIT || action === DASHBOARD_QUICK_ACTION.PAYMENT;

  const close = (open: boolean): void => {
    if (!open) {
      setStep(null);
    }
  };

  return (
    <Widget data-testid="dashboard-quick-actions" title={t("dashboard.widgets.quickActions.title")}>
      <div className="mt-3 flex flex-col gap-2">
        {actions.map((action, index) => (
          <Button
            key={action}
            variant={index === 0 ? "primary" : "secondary"}
            data-testid={`dashboard-quick-${action}`}
            icon={<Icon name={ACTION_ICON[action]} />}
            className="justify-start"
            onClick={() => setStep({ action, patientId: null })}
          >
            {t(`dashboard.quick.${action}`)}
          </Button>
        ))}
      </div>

      <PatientFormModal
        data-testid="dashboard-quick-patient-modal"
        open={step?.action === DASHBOARD_QUICK_ACTION.PATIENT}
        onOpenChange={close}
        onCreated={(patientId) => {
          setStep(null);
          navigate(`/patients/${patientId}`);
        }}
      />

      <ChoosePatientModal
        data-testid="dashboard-quick-choose"
        open={step !== null && choosesPatient(step.action) && step.patientId === null}
        title={
          step?.action === DASHBOARD_QUICK_ACTION.PAYMENT
            ? "dashboard.quick.payment"
            : "dashboard.quick.visit"
        }
        onOpenChange={close}
        onChosen={(patientId) => setStep((current) => current && { ...current, patientId })}
      />

      {step?.action === DASHBOARD_QUICK_ACTION.VISIT && step.patientId !== null && (
        <VisitFormModal
          data-testid="dashboard-quick-visit-modal"
          open
          onOpenChange={close}
          patientId={step.patientId}
          doctors={doctors.data?.items ?? []}
          visit={null}
        />
      )}

      {step?.action === DASHBOARD_QUICK_ACTION.PAYMENT && step.patientId !== null && (
        <PatientPaymentModal
          data-testid="dashboard-quick-payment-modal"
          open
          onOpenChange={close}
          patientId={step.patientId}
          currency={currency}
        />
      )}

      {step?.action === DASHBOARD_QUICK_ACTION.APPOINTMENT && (
        <AppointmentFormModal
          data-testid="dashboard-quick-appointment-modal"
          open
          onOpenChange={close}
        />
      )}
    </Widget>
  );
}
