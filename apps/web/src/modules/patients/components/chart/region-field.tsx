import {
  BODY_SIDE,
  LOOKUP_LIST,
  PAIRED_SIDES,
  isPairedRegion,
  lookupLabel,
  type BodyRegionLocation,
  type BodySide,
} from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { FormField, Select } from "@clinic/ui";
import type { FieldErrors } from "@web/shared/lib/form-errors";
import { useLookupList } from "@web/shared/queries/lookups";

export function RegionField({
  id,
  value,
  error,
  onChange,
}: {
  readonly id: string;
  readonly value: BodyRegionLocation | null;
  readonly error?: FieldErrors[string] | undefined;
  readonly onChange: (next: BodyRegionLocation | null) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const regions = useLookupList(LOOKUP_LIST.BODY_REGION);
  const paired = regions.some(
    (option) => option.code === value?.region && isPairedRegion(option.meta),
  );

  const pickRegion = (code: string): void => {
    if (code === "") {
      onChange(null);
      return;
    }

    const option = regions.find((candidate) => candidate.code === code);
    const side = value?.side && PAIRED_SIDES.includes(value.side) ? value.side : undefined;

    if (!isPairedRegion(option?.meta)) {
      onChange({ region: code, side: BODY_SIDE.MIDLINE });
    } else {
      onChange(side ? { region: code, side } : { region: code });
    }
  };

  return (
    <div className="grid gap-4 @lg:grid-cols-2">
      <FormField label="chart.body.region" htmlFor={`${id}-region`} optional>
        <Select
          searchable
          id={`${id}-region`}
          data-testid="treatment-field-region"
          value={value?.region ?? ""}
          placeholder={t("chart.body.pickRegion")}
          onChange={(event) => pickRegion(event.target.value)}
          options={regions.map((option) => ({
            value: option.code,
            label: lookupLabel(option, i18n.language),
          }))}
        />
      </FormField>

      {value && paired && (
        <FormField label="chart.body.sideLabel" htmlFor={`${id}-side`} error={error} required>
          <Select
            id={`${id}-side`}
            data-testid="treatment-field-side"
            value={value.side ?? ""}
            placeholder={t("chart.body.pickSide")}
            onChange={(event) =>
              onChange({ region: value.region, side: event.target.value as BodySide })
            }
            options={PAIRED_SIDES.map((side) => ({
              value: side,
              label: t(`chart.body.side.${side}`),
            }))}
          />
        </FormField>
      )}
    </div>
  );
}
