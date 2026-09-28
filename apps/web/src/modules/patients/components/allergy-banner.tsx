import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { USER_ROLE } from "@clinic/shared";
import { Icon } from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { useAllergyFlags } from "@web/modules/patients/queries";
import { cn } from "@clinic/ui/lib/cn";
import { formatList } from "@web/shared/lib/format";

export function AllergyBanner({ patientId }: { patientId: string }): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const mayRead = user !== null && user.role !== USER_ROLE.RECEPTIONIST;
  const { data } = useAllergyFlags(patientId, mayRead);

  if (!data?.hasAllergies) {
    return null;
  }

  return (
    <span
      role="alert"
      data-testid="allergy-banner"
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5",
        "rounded-pill border border-danger-200 bg-danger-50 py-1 pe-3 ps-2.5",
        "text-value font-medium text-danger-700",
      )}
    >
      <Icon name="alert" className="size-4 shrink-0 text-danger-600" />
      <span>{t("patients.allergies")}:</span>
      <span data-testid="allergy-banner-list" dir="auto">
        {formatList(data.allergies)}
      </span>
    </span>
  );
}
