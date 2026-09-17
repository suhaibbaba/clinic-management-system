import { isBookingName, isBookingPhone } from "@shared/constants/booking";
import { useState, type FormEvent, type JSX } from "react";

import { t } from "@web/booking/i18n";
import { Button, Card, Field } from "@web/booking/ui";

export interface UrgentDetails {
  readonly fullName: string;
  readonly phone: string;
  readonly complaint: string;
}

export function UrgentStep({
  details,
  onChange,
  onSubmit,
  onBack,
  busy,
}: {
  readonly details: UrgentDetails;
  readonly onChange: (details: UrgentDetails) => void;
  readonly onSubmit: () => void;
  readonly onBack: () => void;
  readonly busy: boolean;
}): JSX.Element {
  const [touched, setTouched] = useState(false);

  const nameError = isBookingName(details.fullName) ? undefined : t("details.nameError");
  const phoneError = isBookingPhone(details.phone) ? undefined : t("details.phoneError");
  const complaintError =
    details.complaint.trim().length >= 3 ? undefined : t("urgent.complaintError");

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setTouched(true);

    if (!nameError && !phoneError && !complaintError) {
      onSubmit();
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Card className="bg-primary-50 shadow-none">
        <p className="text-value text-ink">{t("urgent.promise")}</p>
      </Card>

      <Field
        label={t("details.name")}
        name="fullName"
        autoComplete="name"
        placeholder={t("details.namePlaceholder")}
        value={details.fullName}
        error={touched ? nameError : undefined}
        onChange={(event) => onChange({ ...details, fullName: event.target.value })}
      />

      <Field
        label={t("details.phone")}
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        autoComplete="tel"
        placeholder={t("details.phonePlaceholder")}
        hint={t("urgent.phoneHint")}
        value={details.phone}
        error={touched ? phoneError : undefined}
        onChange={(event) => onChange({ ...details, phone: event.target.value })}
      />

      <Field
        label={t("urgent.complaint")}
        name="complaint"
        placeholder={t("urgent.complaintPlaceholder")}
        value={details.complaint}
        error={touched ? complaintError : undefined}
        onChange={(event) => onChange({ ...details, complaint: event.target.value })}
      />

      <Button type="submit" full busy={busy}>
        {t("urgent.submit")}
      </Button>

      <Button type="button" variant="ghost" full onClick={onBack}>
        {t("common.back")}
      </Button>
    </form>
  );
}

/** No time, no queue position — the page must not imply either. */
export function UrgentSentView(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-heading font-medium text-ink">{t("urgent.sentHeading")}</p>
      <p className="text-value text-ink-muted">{t("urgent.sentBody")}</p>
    </div>
  );
}
