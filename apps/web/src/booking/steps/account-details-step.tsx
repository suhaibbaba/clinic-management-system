import { useState, type FormEvent, type JSX, type ReactNode } from "react";
import { t } from "@web/booking/i18n";
import { isBookingNameComplete, NameFields } from "@web/booking/steps/name-fields";
import { Button, ChoiceCard, Field } from "@web/booking/ui";

export interface BookingAccountPatient {
  readonly id: string;
  readonly firstName: string;
  readonly fullName: string;
}

export interface BookingAccount {
  readonly patients: readonly BookingAccountPatient[];
  readonly onBooked: () => void;
}

export interface AccountDetails {
  readonly patientId: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly reason: string;
}

export function AccountDetailsStep({
  account,
  details,
  onChange,
  onSubmit,
  busy,
  summary,
  ready,
}: {
  readonly account: BookingAccount;
  readonly details: AccountDetails;
  readonly onChange: (details: AccountDetails) => void;
  readonly onSubmit: () => void;
  readonly busy: boolean;
  readonly summary?: ReactNode;
  readonly ready: boolean;
}): JSX.Element {
  const [touched, setTouched] = useState(false);
  const someoneElse = details.patientId === null;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setTouched(true);

    if (ready && (!someoneElse || isBookingNameComplete(details))) {
      onSubmit();
    }
  };

  return (
    <form
      data-testid="account-details-step"
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4"
    >
      {summary}

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-value font-bold text-ink">{t("details.forWhom")}</legend>

        {account.patients.map((patient) => (
          <ChoiceCard
            key={patient.id}
            data-testid={`account-details-patient-${patient.id}`}
            selected={details.patientId === patient.id}
            label={patient.fullName}
            onClick={() => onChange({ ...details, patientId: patient.id })}
          >
            <span
              aria-hidden
              className="pill-text inline-flex size-(--control-h) shrink-0 items-center justify-center rounded-pill bg-primary-100 text-value font-bold text-primary-800"
            >
              {patient.firstName.charAt(0)}
            </span>
            <span className="min-w-0 flex-1 truncate text-value font-medium text-ink">
              {patient.fullName}
            </span>
          </ChoiceCard>
        ))}

        <ChoiceCard
          data-testid="account-details-someone-else"
          selected={someoneElse}
          label={t("details.someoneElse")}
          onClick={() => onChange({ ...details, patientId: null })}
        >
          <span
            aria-hidden
            className="pill-text inline-flex size-(--control-h) shrink-0 items-center justify-center rounded-pill border border-dashed border-primary-300 text-heading font-bold text-primary-700"
          >
            +
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-value font-medium text-ink">{t("details.someoneElse")}</span>
            <span className="text-label text-ink-muted">{t("details.someoneElseHint")}</span>
          </span>
        </ChoiceCard>
      </fieldset>

      {someoneElse && (
        <NameFields
          prefix="account-details"
          value={details}
          touched={touched}
          onChange={(name) => onChange({ ...details, ...name })}
        />
      )}

      <Field
        data-testid="account-details-field-reason"
        label={t("details.reason")}
        name="reason"
        placeholder={t("details.reasonPlaceholder")}
        value={details.reason}
        onChange={(event) => onChange({ ...details, reason: event.target.value })}
      />

      <Button type="submit" full data-testid="account-details-submit" busy={busy} disabled={!ready}>
        {t("details.submit")}
      </Button>

      {!ready && (
        <p
          data-testid="account-details-pick-time"
          className="text-center text-label text-ink-muted"
        >
          {t("board.pickTimeFirst")}
        </p>
      )}
    </form>
  );
}
