import {
  CLOCK_FORMATS,
  LANGUAGE_CODES,
  languageDefinition,
  type ClockFormat,
  type LanguageCode,
} from "@clinic/shared";
import { useMemo, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, FormField, Select } from "@clinic/ui";
import { dateLocale } from "@web/shared/lib/format";

export interface ClinicLocaleDraft {
  readonly languages: readonly LanguageCode[];
  readonly documentLanguage: LanguageCode;
  readonly timeZone: string;
  readonly clock: ClockFormat;
  readonly weekStart: number;
}

export interface ClinicLocaleSectionProps {
  readonly value: ClinicLocaleDraft;
  readonly onChange: (next: ClinicLocaleDraft) => void;
  readonly onApplyCountry: () => void;
  readonly canEdit: boolean;
}

const SUNDAY = Date.UTC(2023, 0, 1);
const DAY = 86_400_000;

function timeZones(current: string): readonly string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");

    return zones.includes(current) ? zones : [current, ...zones];
  } catch {
    return [current];
  }
}

export function ClinicLocaleSection({
  value,
  onChange,
  onApplyCountry,
  canEdit,
}: ClinicLocaleSectionProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const zones = useMemo(() => timeZones(value.timeZone), [value.timeZone]);
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(dateLocale(), { weekday: "long", timeZone: "UTC" });

    return Array.from({ length: 7 }, (_, day) => format.format(new Date(SUNDAY + day * DAY)));
  }, [i18n.language]);

  const set = (patch: Partial<ClinicLocaleDraft>): void => onChange({ ...value, ...patch });

  const toggle = (language: LanguageCode, on: boolean): void => {
    const languages = on
      ? LANGUAGE_CODES.filter((code) => code === language || value.languages.includes(code))
      : value.languages.filter((code) => code !== language);

    if (languages.length === 0) {
      return;
    }

    const primary = value.languages[0];
    const ordered =
      primary && languages.includes(primary)
        ? [primary, ...languages.filter((code) => code !== primary)]
        : languages;

    set({
      languages: ordered,
      documentLanguage: ordered.includes(value.documentLanguage)
        ? value.documentLanguage
        : (ordered[0] ?? value.documentLanguage),
    });
  };

  const languageOptions = (codes: readonly LanguageCode[]) =>
    codes.map((code) => ({ value: code, label: languageDefinition(code).nativeName }));

  return (
    <section
      data-testid="clinic-locale"
      className="border border-line rounded-card bg-surface shadow-card p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-value font-medium text-ink">{t("clinic.locale.title")}</h2>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="clinic-locale-apply-country"
            onClick={onApplyCountry}
          >
            {t("clinic.locale.applyCountry")}
          </Button>
        )}
      </div>

      <div className="flex max-w-(--form-max) flex-col gap-4">
        <FormField
          label="clinic.locale.languages"
          htmlFor="clinic-locale-languages"
          hint="clinic.locale.languagesHint"
        >
          <div id="clinic-locale-languages" className="flex flex-wrap gap-x-5 gap-y-1">
            {LANGUAGE_CODES.map((code) => (
              <Checkbox
                key={code}
                data-testid={`clinic-locale-language-${code}`}
                label={languageDefinition(code).nativeName}
                checked={value.languages.includes(code)}
                onCheckedChange={(on) => canEdit && toggle(code, on)}
              />
            ))}
          </div>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="clinic.locale.primaryLanguage"
            htmlFor="clinic-locale-primary"
            hint="clinic.locale.primaryLanguageHint"
          >
            <Select
              id="clinic-locale-primary"
              data-testid="clinic-locale-primary"
              className="w-full"
              value={value.languages[0] ?? ""}
              disabled={!canEdit}
              options={languageOptions(value.languages)}
              onChange={(event) => {
                const primary = event.target.value as LanguageCode;

                set({
                  languages: [primary, ...value.languages.filter((code) => code !== primary)],
                });
              }}
            />
          </FormField>

          <FormField
            label="clinic.locale.documentLanguage"
            htmlFor="clinic-locale-document"
            hint="clinic.locale.documentLanguageHint"
          >
            <Select
              id="clinic-locale-document"
              data-testid="clinic-locale-document"
              className="w-full"
              value={value.documentLanguage}
              disabled={!canEdit}
              options={languageOptions(value.languages)}
              onChange={(event) => set({ documentLanguage: event.target.value as LanguageCode })}
            />
          </FormField>

          <FormField label="clinic.locale.timeZone" htmlFor="clinic-locale-zone">
            <Select
              id="clinic-locale-zone"
              data-testid="clinic-locale-zone"
              className="w-full"
              searchable
              value={value.timeZone}
              disabled={!canEdit}
              options={zones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
              onChange={(event) => set({ timeZone: event.target.value })}
            />
          </FormField>

          <FormField label="clinic.locale.clock" htmlFor="clinic-locale-clock">
            <Select
              id="clinic-locale-clock"
              data-testid="clinic-locale-clock"
              className="w-full"
              value={value.clock}
              disabled={!canEdit}
              options={CLOCK_FORMATS.map((clock) => ({
                value: clock,
                label: t(`clinic.locale.clocks.${clock}`),
              }))}
              onChange={(event) => set({ clock: event.target.value as ClockFormat })}
            />
          </FormField>

          <FormField label="clinic.locale.weekStart" htmlFor="clinic-locale-week">
            <Select
              id="clinic-locale-week"
              data-testid="clinic-locale-week"
              className="w-full"
              value={String(value.weekStart)}
              disabled={!canEdit}
              options={weekdays.map((name, day) => ({ value: String(day), label: name }))}
              onChange={(event) => set({ weekStart: Number(event.target.value) })}
            />
          </FormField>
        </div>
      </div>
    </section>
  );
}
