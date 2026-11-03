import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@clinic/ui";
import { PatientPicker } from "@web/shared/components/patient-picker";
import type { PatientChoice } from "@web/shared/lib/patient-draft";

export interface ChoosePatientModalProps {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly title: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChosen: (patientId: string) => void;
}

export function ChoosePatientModal({
  open,
  title,
  onOpenChange,
  onChosen,
  "data-testid": testId = "choose-patient-modal",
}: ChoosePatientModalProps): JSX.Element {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<PatientChoice | null>(null);
  const patientId = choice?.kind === "existing" ? choice.patient.id : null;

  const close = (next: boolean): void => {
    if (!next) {
      setChoice(null);
    }

    onOpenChange(next);
  };

  const proceed = (): void => {
    if (patientId !== null) {
      setChoice(null);
      onChosen(patientId);
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={close}
      title={title}
      onEnter={proceed}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid={`${testId}-continue`}
            aria-disabled={patientId === null}
            onClick={proceed}
          >
            {t("common.continue")}
          </Button>
        </>
      }
    >
      <PatientPicker id={`${testId}-picker`} value={choice} onChange={setChoice} allowNew={false} />
    </Modal>
  );
}
