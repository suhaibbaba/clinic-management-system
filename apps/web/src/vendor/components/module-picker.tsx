import { CLINIC_MODULES, type ClinicModule } from "@clinic/shared";
import { Checkbox } from "@clinic/ui/components/checkbox";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

export function ModulePicker({
  value,
  onChange,
  included = [],
  "data-testid": testId,
}: {
  readonly value: readonly ClinicModule[];
  readonly onChange: (modules: ClinicModule[]) => void;
  readonly included?: readonly ClinicModule[];
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toggle = (module: ClinicModule, on: boolean): void =>
    onChange(CLINIC_MODULES.filter((entry) => (entry === module ? on : value.includes(entry))));

  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid={testId}>
      {CLINIC_MODULES.map((module) =>
        included.includes(module) ? (
          <span key={module} className="flex items-center gap-2 text-ink-muted">
            <Checkbox checked label={t(`vendor.modules.${module}`)} onCheckedChange={() => {}} />
            <span className="text-meta">{t("vendor.clinic.includedInPlan")}</span>
          </span>
        ) : (
          <Checkbox
            key={module}
            checked={value.includes(module)}
            label={t(`vendor.modules.${module}`)}
            onCheckedChange={(on) => toggle(module, on)}
            data-testid={`${testId ?? "modules"}-${module}`}
          />
        ),
      )}
    </div>
  );
}
