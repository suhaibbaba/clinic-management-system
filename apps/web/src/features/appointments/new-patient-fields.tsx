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
    <div className="flex flex-col gap-3 rounded-control border border-primary-200 bg-primary-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-medium text-ink">{t("patients.createInline")}</span>
        <Button size="sm" variant="ghost" icon={<Icon name="x" />} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>

      {clash && (
        <div className="flex flex-wrap items-center gap-2 rounded-control bg-warning-100 px-3 py-2">
          <span className="text-label text-warning-700">
            {t("patients.phoneTaken", { name: clash.fullName })}
          </span>
          <Button size="sm" variant="secondary" onClick={() => onUseExisting(clash)}>
            {t("patients.useExisting")}
          </Button>
        </div>
      )}

      <FormField label="patients.fullName" htmlFor={`${id}-name`} required>
        <Input
          id={`${id}-name`}
          value={draft.fullName}
          onChange={(event) => onChange({ ...draft, fullName: event.target.value })}
        />
      </FormField>

      <FormField label="patients.phone" htmlFor={`${id}-phone`} required>
        <Input
          id={`${id}-phone`}
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
            startView="years"
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
