import { isBookingPhone } from "@shared/constants/booking";
import { joinPhone, type PhoneCountry } from "@shared/constants/phone";
import { PhoneCountrySelect } from "@clinic/ui/components/phone-country-select";
import { useState, type FormEvent, type JSX, type ReactNode } from "react";
import { t } from "@web/booking/i18n";
import { isBookingNameComplete, NameFields } from "@web/booking/steps/name-fields";
import { Button, Field } from "@web/booking/ui";

export interface BookingDetails {
  readonly country: PhoneCountry;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly reason: string;
}

export function DetailsStep({
  details,
  onChange,
  onSubmit,
  busy,
  summary,
  ready,
}: {
  readonly details: BookingDetails;
  readonly onChange: (details: BookingDetails) => void;
  readonly onSubmit: () => void;
  readonly busy: boolean;
  readonly summary?: ReactNode;
  readonly ready: boolean;
}): JSX.Element {
  const [touched, setTouched] = useState(false);

  const nameError = !isBookingNameComplete(details);
  const phoneError = isBookingPhone(joinPhone(details.country, details.phone) ?? "")
    ? undefined
    : t("details.phoneError");
  const typedWhole = /^\s*(\+|00)/.test(details.phone);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setTouched(true);

    if (ready && !nameError && !phoneError) {
      onSubmit();
    }
  };

  return (
    <form data-testid="details-step" noValidate onSubmit={submit} className="flex flex-col gap-4">
      {summary}

      <NameFields
        prefix="details"
        value={details}
        touched={touched}
        onChange={(name) => onChange({ ...details, ...name })}
      />

      <Field
        data-testid="details-field-phone"
        {...(!typedWhole && {
          addon: (
            <PhoneCountrySelect
              country={details.country}
              onChange={(country) => onChange({ ...details, country })}
              language="ar"
              label={t("details.country")}
              data-testid="details-country"
            />
          ),
        })}
        label={t("details.phone")}
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        autoComplete="tel"
        placeholder={t("details.phonePlaceholder")}
        hint={t("details.phoneHint")}
        value={details.phone}
        error={touched ? phoneError : undefined}
        onChange={(event) => onChange({ ...details, phone: event.target.value })}
      />

      <Field
        data-testid="details-field-reason"
        label={t("details.reason")}
        name="reason"
        placeholder={t("details.reasonPlaceholder")}
        value={details.reason}
        onChange={(event) => onChange({ ...details, reason: event.target.value })}
      />

      <p className="text-label text-ink-muted">{t("details.terms")}</p>

      <Button type="submit" full data-testid="details-submit" busy={busy} disabled={!ready}>
        {t("details.submit")}
      </Button>

      {!ready && (
        <p data-testid="details-pick-time" className="text-center text-label text-ink-muted">
          {t("board.pickTimeFirst")}
        </p>
      )}
    </form>
  );
}
