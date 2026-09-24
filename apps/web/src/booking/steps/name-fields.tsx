import { isBookingName } from "@shared/constants/booking";
import type { JSX } from "react";
import { t } from "@web/booking/i18n";
import { Field } from "@web/booking/ui";

export interface BookingName {
  readonly firstName: string;
  readonly lastName: string;
}

export const isBookingNameComplete = (name: BookingName): boolean =>
  isBookingName(name.firstName) && isBookingName(name.lastName);

export function NameFields({
  prefix,
  value,
  touched,
  onChange,
}: {
  /** `details` or `urgent`, for the testids. */
  readonly prefix: string;
  readonly value: BookingName;
  readonly touched: boolean;
  readonly onChange: (name: BookingName) => void;
}): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        data-testid={`${prefix}-field-first-name`}
        label={t("details.firstName")}
        name="firstName"
        autoComplete="given-name"
        placeholder={t("details.firstNamePlaceholder")}
        value={value.firstName}
        error={touched && !isBookingName(value.firstName) ? t("details.firstNameError") : undefined}
        onChange={(event) => onChange({ ...value, firstName: event.target.value })}
      />

      <Field
        data-testid={`${prefix}-field-last-name`}
        label={t("details.lastName")}
        name="lastName"
        autoComplete="family-name"
        placeholder={t("details.lastNamePlaceholder")}
        value={value.lastName}
        error={touched && !isBookingName(value.lastName) ? t("details.lastNameError") : undefined}
        onChange={(event) => onChange({ ...value, lastName: event.target.value })}
      />
    </div>
  );
}
