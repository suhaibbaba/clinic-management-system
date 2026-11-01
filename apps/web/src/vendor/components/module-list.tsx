import type { ClinicModule } from "@clinic/shared";
import { Chip } from "@clinic/ui/components/badge";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

export function ModuleList({
  modules,
}: {
  readonly modules: readonly ClinicModule[];
}): JSX.Element {
  const { t } = useTranslation();

  if (modules.length === 0) {
    return <span className="text-ink-muted">{t("vendor.clinic.none")}</span>;
  }

  return (
    <span className="flex flex-wrap gap-1" data-testid="vendor-modules">
      {modules.map((module) => (
        <Chip key={module}>{t(`vendor.modules.${module}`)}</Chip>
      ))}
    </span>
  );
}
