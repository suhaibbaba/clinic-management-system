import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  joinPhone,
  splitPhone,
  type PhoneCountry,
} from "@clinic/shared";
import {
  AE,
  BH,
  DE,
  EG,
  GB,
  IL,
  IQ,
  JO,
  KW,
  LB,
  OM,
  PS,
  QA,
  SA,
  SY,
  TR,
  US,
} from "country-flag-icons/react/3x2";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Input, type InputProps } from "@ui/components/input";
import { Select } from "@ui/components/select";
import { cn } from "@ui/lib/cn";
import { foldDigits } from "@ui/lib/digits";
import type { TestIdProps } from "@ui/lib/testid";

// Named one by one so the bundle carries these flags and not the other two hundred.
const FLAGS: Record<PhoneCountry, typeof PS> = {
  PS,
  IL,
  JO,
  EG,
  SA,
  AE,
  QA,
  KW,
  BH,
  OM,
  LB,
  SY,
  IQ,
  TR,
  GB,
  DE,
  US,
};

const PhoneCountryContext = createContext<PhoneCountry>(DEFAULT_PHONE_COUNTRY);

/** The country every phone field starts on — the clinic's, set once at the app's root. */
export function PhoneCountryProvider({
  country,
  children,
}: {
  readonly country: PhoneCountry;
  readonly children: ReactNode;
}): JSX.Element {
  return <PhoneCountryContext.Provider value={country}>{children}</PhoneCountryContext.Provider>;
}

export function Flag({
  country,
  className,
}: {
  readonly country: PhoneCountry;
  readonly className?: string | undefined;
}): JSX.Element {
  const Svg = FLAGS[country];

  return (
    <Svg
      aria-hidden="true"
      className={cn("h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-line", className)}
    />
  );
}

export interface PhoneInputProps
  extends
    Omit<InputProps, "type" | "inputMode" | "dir" | "value" | "defaultValue" | "onChange">,
    TestIdProps {
  /** International, as stored: `+970599123456`. */
  readonly value: string | null | undefined;
  readonly onChange: (value: string | null) => void;
}

/** Digits, spaces and dashes, and a `+` only at the front — where a dialling code puts it. */
const phoneCharacters = (value: string): string =>
  foldDigits(value)
    .replace(/[^\d\s+-]/g, "")
    .replace(/(?!^)\+/g, "");

// A picker and a box, one value: the code is chosen, the rest typed as the patient says it, and
// what reaches the form is international — `+962` and `079…` arrive as `+96279…`.
export function PhoneInput({
  value,
  onChange,
  onBlur,
  hasError,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  "data-testid": testId,
  ...props
}: PhoneInputProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const fallback = useContext(PhoneCountryContext);

  const [country, setCountry] = useState<PhoneCountry>(() => splitPhone(value, fallback).country);
  // What was typed, kept as typed: the trunk 0 is dropped from the value, not from the box.
  const [local, setLocal] = useState(() => splitPhone(value, fallback).local);

  useEffect(() => {
    if (joinPhone(country, local) !== (value ?? null)) {
      const next = splitPhone(value, fallback);

      setCountry(next.country);
      setLocal(next.local);
    }
  }, [value, fallback]);

  const names = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: "region" }),
    [i18n.language],
  );

  const emit = (nextCountry: PhoneCountry, nextLocal: string): void => {
    setCountry(nextCountry);
    setLocal(nextLocal);
    onChange(joinPhone(nextCountry, nextLocal));
  };

  return (
    // Left to right whatever the page: a number reads code first.
    <div data-part="phone-input" dir="ltr" className={cn("flex gap-2", className)}>
      <Select
        className="w-[7.5rem] shrink-0"
        listClassName="w-auto min-w-64"
        {...(testId !== undefined && { "data-testid": `${testId}-country` })}
        aria-label={t("common.diallingCode")}
        value={country}
        disabled={disabled}
        hasError={hasError}
        options={PHONE_COUNTRIES.map((entry) => ({
          value: entry.country,
          label: `${names.of(entry.country) ?? entry.country} ${entry.dial}`,
          icon: <Flag country={entry.country} />,
        }))}
        renderValue={(option) => {
          const entry = PHONE_COUNTRIES.find((item) => item.country === option.value);

          return entry ? (
            <span className="inline-flex items-center gap-2 tabular-nums" dir="ltr">
              <Flag country={entry.country} />
              {entry.dial}
            </span>
          ) : null;
        }}
        onChange={(event) => {
          const next = PHONE_COUNTRIES.find((entry) => entry.country === event.target.value);

          if (next) {
            emit(next.country, local);
          }
        }}
      />

      <Input
        {...props}
        id={id}
        {...(testId !== undefined && { "data-testid": testId })}
        aria-label={ariaLabel}
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel-national"
        className="min-w-0 flex-1 tabular-nums"
        hasError={hasError}
        disabled={disabled}
        value={local}
        onBlur={onBlur}
        onChange={(event) => emit(country, phoneCharacters(event.target.value))}
      />
    </div>
  );
}
