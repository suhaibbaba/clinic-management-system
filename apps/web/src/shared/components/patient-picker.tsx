import { type PickedPatient, type PatientChoice } from "@web/shared/lib/patient-draft";
import { type PatientView } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Badge, Icon, Ltr, Popover, SearchField } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { NewPatientFields } from "@web/shared/components/new-patient-fields";
import { usePatients } from "@web/shared/queries/patients";
import { useDebounced } from "@web/shared/hooks/use-debounced";
import { cn } from "@clinic/ui/lib/cn";
import { ellipsis } from "@web/i18n/ellipsis";

export interface PatientPickerProps {
  readonly value: PatientChoice | null;
  readonly onChange: (choice: PatientChoice | null) => void;
  readonly id: string;
  readonly clash?: PickedPatient | null | undefined;
  readonly allowNew?: boolean;
}

export function PatientPicker({
  value,
  onChange,
  id,
  clash,
  allowNew = true,
}: PatientPickerProps): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(search);

  const term = debounced.trim();
  const results = usePatients(
    { limit: 8, ...(term !== "" && { search: term }) },
    { enabled: term !== "" },
  );
  const matches = results.data?.items ?? [];

  if (value?.kind === "existing") {
    return (
      <div
        data-testid="patient-picker-selected"
        className="flex items-center gap-3 rounded-control border border-line bg-inset px-3 py-2"
      >
        <Avatar name={value.patient.fullName} tintKey={value.patient.id} />
        <span className="flex min-w-0 flex-1 flex-col leading-label">
          <span
            data-testid="patient-picker-name"
            className="truncate text-value font-medium text-ink"
          >
            {value.patient.fullName}
          </span>
          <Ltr className="truncate text-label tabular-nums text-ink-subtle">
            {value.patient.phone}
          </Ltr>
        </span>
        {value.patient.profileIncomplete && (
          <Badge tone="warning">{t("patients.incomplete")}</Badge>
        )}
        <button
          type="button"
          data-testid="patient-picker-clear"
          onClick={() => onChange(null)}
          aria-label={t("common.clear")}
          className="cursor-pointer rounded-control p-1 text-ink-subtle transition-colors duration-150 hover:text-ink"
        >
          <Icon name="x" className="size-4" />
        </button>
      </div>
    );
  }

  if (value?.kind === "new") {
    return (
      <NewPatientFields
        id={id}
        draft={value.draft}
        onChange={(draft) => onChange({ kind: "new", draft })}
        onCancel={() => onChange(null)}
        {...(clash ? { clash } : {})}
        onUseExisting={(patient) => onChange({ kind: "existing", patient })}
      />
    );
  }

  const typed = search.trim();
  const settled = term === typed && !results.isFetching;
  const visible = settled ? matches : [];
  const offerNew = allowNew && typed !== "";
  const open = typed !== "" && !dismissed;
  const optionCount = visible.length + (offerNew ? 1 : 0);
  const newPatientIndex = offerNew ? visible.length : -1;
  const activeIndex = optionCount === 0 ? -1 : Math.min(active, optionCount - 1);
  const optionId = (index: number): string => `${id}-option-${index}`;

  const choose = (index: number): void => {
    if (index === newPatientIndex) {
      onChange({ kind: "new", draft: { firstName: typed.trim(), lastName: "", phone: "" } });
      return;
    }

    const picked = visible[index];

    if (picked) {
      onChange({ kind: "existing", patient: toPicked(picked) });
      setSearch("");
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDismissed(true);
        }
      }}
      focusOnOpen={false}
      title={t("patients.search")}
      className="w-(--radix-popover-trigger-width) p-0"
      anchor={
        <div>
          <SearchField
            id={id}
            data-testid="patient-picker-search"
            label={t("patients.search")}
            placeholder={ellipsis(t("patients.searchPlaceholder"))}
            value={search}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            aria-autocomplete="list"
            {...(open && activeIndex >= 0 && { "aria-activedescendant": optionId(activeIndex) })}
            onChange={(event) => {
              setSearch(event.target.value);
              setDismissed(false);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setDismissed(false);

                if (open && optionCount > 0) {
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  const next = (activeIndex + step + optionCount) % optionCount;

                  setActive(next);
                  document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
                }
              } else if (event.key === "Enter" && open && activeIndex >= 0) {
                event.preventDefault();
                choose(activeIndex);
              }
            }}
            clearLabel={t("common.clear")}
            onClear={() => {
              setSearch("");
              setDismissed(false);
            }}
          />
        </div>
      }
    >
      <div
        id={`${id}-listbox`}
        data-testid="patient-picker-results"
        role="listbox"
        aria-label={t("patients.search")}
      >
        <div role="presentation" className="max-h-56 overflow-y-auto">
          {!settled &&
            [0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-24" />
                </span>
              </div>
            ))}

          {settled && visible.length === 0 && (
            <p
              data-testid="patient-picker-no-matches"
              className="px-3 py-2.5 text-label text-ink-muted"
            >
              {t("patients.noMatches")}
            </p>
          )}

          {visible.map((patient, index) => (
            <div
              key={patient.id}
              id={optionId(index)}
              data-testid={`patient-picker-option-${patient.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => choose(index)}
              onPointerMove={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2 text-start",
                index === activeIndex && "bg-row-hover",
              )}
            >
              <Avatar name={patient.fullName} tintKey={patient.id} />
              <span className="flex min-w-0 flex-col leading-label">
                <span className="truncate text-value text-ink">{patient.fullName}</span>
                <Ltr className="truncate text-label tabular-nums text-ink-subtle">
                  {patient.fileNumber} · {patient.phone}
                </Ltr>
              </span>
              {patient.profileIncomplete && (
                <Badge tone="warning" className="ms-auto">
                  {t("patients.incomplete")}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {offerNew && (
          <div
            id={optionId(newPatientIndex)}
            data-testid="patient-picker-create"
            role="option"
            aria-selected={newPatientIndex === activeIndex}
            data-new-patient
            onClick={() => choose(newPatientIndex)}
            onPointerMove={() => setActive(newPatientIndex)}
            className={cn(
              "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-start",
              "bg-surface text-value font-medium text-primary-600",
              "border-t border-line",
              newPatientIndex === activeIndex && "bg-row-hover",
            )}
          >
            <Icon name="user-plus" className="size-4 shrink-0" />
            <span className="truncate">{t("patients.createNamed", { name: typed })}</span>
          </div>
        )}
      </div>
    </Popover>
  );
}

const toPicked = (patient: PatientView): PickedPatient => ({
  id: patient.id,
  fullName: patient.fullName,
  phone: patient.phone,
  fileNumber: patient.fileNumber,
  profileIncomplete: patient.profileIncomplete,
});
