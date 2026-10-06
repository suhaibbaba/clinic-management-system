import {
  LOOKUP_LIST,
  lookupLabel,
  readDrugRegimen,
  regimenShorthand,
  type LookupOption,
} from "@clinic/shared";
import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon, Input, Ltr, Popover, useToast } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { useCreateLookupOption, useLookupList } from "@web/shared/queries/lookups";
import { useSession } from "@web/shared/providers/session";
import { canAddLookupOption } from "@web/shared/permissions/lookups";
import { errorToast } from "@web/shared/lib/api-error";
import { drugSuggestions, isKnownDrug } from "@web/modules/patients/lib/prescriptions";

interface DrugPickerProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (name: string) => void;
  readonly onBlur: () => void;
  readonly onPick: (option: LookupOption) => void;
  readonly placeholder: string;
  readonly hasError?: boolean | undefined;
  readonly "data-testid": string;
}

export const DrugPicker = forwardRef<HTMLInputElement, DrugPickerProps>(function DrugPicker(
  { id, value, onChange, onBlur, onPick, placeholder, hasError, "data-testid": testId },
  ref,
) {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const create = useCreateLookupOption();
  const options = useLookupList(LOOKUP_LIST.FREQUENT_DRUG);

  const [dismissed, setDismissed] = useState(true);
  const [active, setActive] = useState(0);

  const choices = options.map((option) => ({
    key: option.id,
    label: lookupLabel(option, i18n.language),
  }));
  const typed = value.trim();
  const matches = drugSuggestions(choices, typed, 8);
  const offerNew = canAddLookupOption(can) && typed !== "" && !isKnownDrug(choices, typed);
  const optionCount = matches.length + (offerNew ? 1 : 0);
  const newIndex = offerNew ? matches.length : -1;
  const open = !dismissed && optionCount > 0;
  const activeIndex = optionCount === 0 ? -1 : Math.min(active, optionCount - 1);
  const optionId = (index: number): string => `${id}-option-${index}`;

  const pick = (option: LookupOption): void => {
    onPick(option);
    setDismissed(true);
  };

  const choose = async (index: number): Promise<void> => {
    if (index === newIndex) {
      try {
        const added = await create.mutateAsync({
          listKey: LOOKUP_LIST.FREQUENT_DRUG,
          nameAr: typed,
          nameEn: typed,
        });
        toast.success("prescriptions.drugAdded");
        pick(added);
      } catch (error) {
        toast.error(...errorToast(error));
      }
      return;
    }

    const option = options.find((entry) => entry.id === matches[index]?.key);

    if (option) {
      pick(option);
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
      title={t("prescriptions.drug")}
      className="w-(--radix-popover-trigger-width) p-0"
      anchor={
        <div>
          <Input
            ref={ref}
            id={id}
            data-testid={testId}
            placeholder={placeholder}
            autoComplete="off"
            hasError={hasError}
            value={value}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            aria-autocomplete="list"
            {...(open && activeIndex >= 0 && { "aria-activedescendant": optionId(activeIndex) })}
            onBlur={onBlur}
            onChange={(event) => {
              onChange(event.target.value);
              setDismissed(event.target.value.trim() === "");
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();

                if (!open) {
                  setDismissed(false);
                  return;
                }

                const step = event.key === "ArrowDown" ? 1 : -1;
                const next = (activeIndex + step + optionCount) % optionCount;

                setActive(next);
                document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
              } else if (event.key === "Enter" && open && activeIndex >= 0) {
                event.preventDefault();
                void choose(activeIndex);
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                setDismissed(true);
              }
            }}
          />
        </div>
      }
    >
      <div
        id={`${id}-listbox`}
        data-testid={`${testId}-results`}
        role="listbox"
        aria-label={t("prescriptions.drug")}
      >
        <div role="presentation" className="max-h-56 overflow-y-auto overscroll-contain">
          {matches.map((match, index) => {
            const option = options.find((entry) => entry.id === match.key);
            const shorthand = option ? regimenShorthand(readDrugRegimen(option.meta)) : null;

            return (
              <div
                key={match.key}
                id={optionId(index)}
                data-testid={`${testId}-option-${option?.code ?? match.key}`}
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => void choose(index)}
                onPointerMove={() => setActive(index)}
                className={cn(
                  "flex min-h-(--control-h) cursor-pointer items-center justify-between gap-3 px-3 py-2 text-start",
                  index === activeIndex && "bg-row-hover",
                )}
              >
                <span className="truncate text-value text-ink" dir="auto">
                  {match.label}
                </span>
                {shorthand && (
                  <Ltr className="shrink-0 text-label tabular-nums text-ink-subtle">
                    {shorthand}
                  </Ltr>
                )}
              </div>
            );
          })}
        </div>

        {offerNew && (
          <div
            id={optionId(newIndex)}
            data-testid={`${testId}-create`}
            role="option"
            aria-selected={newIndex === activeIndex}
            aria-disabled={create.isPending || undefined}
            onClick={() => !create.isPending && void choose(newIndex)}
            onPointerMove={() => setActive(newIndex)}
            className={cn(
              "flex min-h-(--control-h) cursor-pointer items-center gap-3 px-3 py-2.5 text-start",
              "text-value font-medium text-primary-600",
              matches.length > 0 && "border-t border-line",
              newIndex === activeIndex && "bg-row-hover",
            )}
          >
            <Icon name="plus" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              {t("prescriptions.addDrugNamed", { name: typed })}
            </span>
          </div>
        )}
      </div>
    </Popover>
  );
});
