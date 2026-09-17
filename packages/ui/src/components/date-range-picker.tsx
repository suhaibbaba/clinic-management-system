import { format } from "date-fns";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@ui/components/button";
import { Calendar } from "@ui/components/calendar";
import { fromIsoDate, toIsoDate } from "@ui/components/date-picker";
import { fieldShell } from "@ui/components/field";
import { Icon } from "@ui/components/icon";
import { openOnArrowDown, usePickerOpen } from "@ui/lib/picker-open";
import { Popover } from "@ui/components/popover";
import { cn } from "@ui/lib/cn";
import { Ltr } from "@ui/components/ltr";

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export interface DateRangePickerProps {
  readonly id: string;
  readonly value: DateRange;
  readonly onChange: (value: DateRange) => void;
  readonly label: string;
  readonly className?: string | undefined;
}

// The second click is always the end, so the pair cannot be inverted, and both dates are chosen
// against the same visible month.
export function DateRangePicker({
  id,
  value,
  onChange,
  label,
  className,
}: DateRangePickerProps): JSX.Element {
  const { t } = useTranslation();
  const picker = usePickerOpen();

  const from = fromIsoDate(value.from);
  const to = fromIsoDate(value.to);
  const dates = [from ? format(from, "dd/MM/yyyy") : "…", to ? format(to, "dd/MM/yyyy") : "…"].join(
    " — ",
  );

  return (
    <Popover
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      anchor={
        <button
          data-part="date-range-picker"
          id={id}
          type="button"
          aria-label={label}
          {...picker.opens(true)}
          onKeyDown={openOnArrowDown(picker.show)}
          className={cn(
            fieldShell({}),
            "cursor-pointer text-start text-field focus-visible:outline-none",
            from || to ? "text-ink" : "text-ink-subtle",
            className,
          )}
        >
          {/* The island isolates the digits; the span around it is the page's direction, so the
              value sits at the inline start of an Arabic form rather than at its far left. */}
          <span data-part="date-range-picker-value" className="min-w-0 flex-1 truncate">
            {from || to ? (
              <Ltr className="truncate tabular-nums">{dates}</Ltr>
            ) : (
              t("common.placeholders.dateRange")
            )}
          </span>
          <Icon name="calendar" className="size-4 shrink-0 text-ink-faint" />
        </button>
      }
    >
      <Calendar
        mode="range"
        selected={from ? { from, ...(to && { to }) } : undefined}
        defaultMonth={from ?? to ?? new Date()}
        onSelect={(range) => {
          onChange({
            from: range?.from ? toIsoDate(range.from) : "",
            to: range?.to ? toIsoDate(range.to) : "",
          });
        }}
      />

      <div
        data-part="picker-footer"
        className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2"
      >
        <Button
          size="sm"
          variant="quiet"
          icon={<Icon name="x" />}
          onClick={() => {
            onChange({ from: "", to: "" });
            picker.onOpenChange(false);
          }}
        >
          {t("common.clear")}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="check" />}
          onClick={() => picker.onOpenChange(false)}
        >
          {t("common.done")}
        </Button>
      </div>
    </Popover>
  );
}
