import { GENDERS } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, DatePicker, FormField, Icon, Input, Select } from "@clinic/ui";
import type { PatientDraft, PickedPatient } from "@web/features/appointments/patient-picker";

export function NewPatientFields({
  id,
  draft,
  onChange,
  onCancel,
  clash,
  onUseExisting,
}: {
  readonly id: string;
  readonly draft: PatientDraft;
  readonly onChange: (draft: PatientDraft) => void;
  readonly onCancel: () => void;
  readonly clash?: PickedPatient;
  readonly onUseExisting: (patient: PickedPatient) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      data-testid="new-patient-fields"
      className="flex flex-col gap-3 rounded-control border border-primary-200 bg-primary-50 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-medium text-ink">{t("patients.createInline")}</span>
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="x" />}
          data-testid="new-patient-cancel"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
      </div>

      {clash && (
        <div
          data-testid="new-patient-clash"
          className="flex flex-wrap items-center gap-2 rounded-control bg-warning-100 px-3 py-2"
        >
          <span className="text-label text-warning-700">
            {t("patients.phoneTaken", { name: clash.fullName })}
          </span>
          <Button
            size="sm"
            variant="secondary"
            data-testid="new-patient-use-existing"
            onClick={() => onUseExisting(clash)}
          >
            {t("patients.useExisting")}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="patients.firstName" htmlFor={`${id}-first-name`} required>
          <Input
            id={`${id}-first-name`}
            data-testid="new-patient-first-name"
            value={draft.firstName}
            onChange={(event) => onChange({ ...draft, firstName: event.target.value })}
          />
        </FormField>

        <FormField label="patients.lastName" htmlFor={`${id}-last-name`} required>
          <Input
            id={`${id}-last-name`}
            data-testid="new-patient-last-name"
            value={draft.lastName}
            onChange={(event) => onChange({ ...draft, lastName: event.target.value })}
          />
        </FormField>
      </div>

      <FormField label="patients.phone" htmlFor={`${id}-phone`} required>
        <Input
          id={`${id}-phone`}
          data-testid="new-patient-phone"
          type="tel"
          dir="ltr"
          value={draft.phone}
          onChange={(event) => onChange({ ...draft, phone: event.target.value })}
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="patients.gender" htmlFor={`${id}-gender`} optional>
          <Select
            id={`${id}-gender`}
            data-testid="new-patient-gender"
            value={draft.gender ?? ""}
            placeholder={t("common.notSpecified")}
            options={GENDERS.map((gender) => ({
              value: gender,
              label: t(`patients.${gender}`),
            }))}
            onChange={(event) => onChange({ ...draft, gender: event.target.value })}
          />
        </FormField>

        <FormField label="patients.dateOfBirth" htmlFor={`${id}-dob`} optional>
          <DatePicker
            id={`${id}-dob`}
            data-testid="new-patient-dob"
            label={t("patients.dateOfBirth")}
            value={draft.dateOfBirth ?? ""}
            onChange={(next) => onChange({ ...draft, dateOfBirth: next })}
          />
        </FormField>
      </div>

      <p className="text-label text-ink-muted">{t("patients.createInlineHint")}</p>
    </div>
  );
}
