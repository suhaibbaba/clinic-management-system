import { LOOKUP_LIST } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Chip, Icon } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { hasInstruction, toggleInstruction } from "@web/shared/lib/instructions";

export function InstructionSuggestions({
  value,
  onChange,
  className,
  "data-testid": testId,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string | undefined;
  readonly "data-testid": string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const options = useLookupOptions(LOOKUP_LIST.DRUG_INSTRUCTION);

  if (options.length === 0) {
    return null;
  }

  return (
    <div
      data-testid={testId}
      role="group"
      aria-label={t("prescriptions.suggestions")}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((option) => {
        const selected = hasInstruction(value, option.label);

        return (
          <Chip
            key={option.value}
            data-testid={`${testId}-${option.value}`}
            selected={selected}
            className="h-(--control-h-sm) gap-1 px-2.5 text-label"
            onClick={() =>
              onChange(
                toggleInstruction(value, option.label, t("prescriptions.instructionSeparator")),
              )
            }
          >
            <Icon name={selected ? "check" : "plus"} className="size-3.5 shrink-0" />
            {option.label}
          </Chip>
        );
      })}
    </div>
  );
}
