import { format, isValid, parse } from "date-fns";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/components/button";
import { Calendar, dateLocale } from "@ui/components/calendar";
import { FIELD_BUTTON, FIELD_TEXT, FieldLock, fieldShell } from "@ui/components/field";
import { Icon } from "@ui/components/icon";
import { openOnArrowDown, usePickerOpen } from "@ui/lib/picker-open";
import { Popover } from "@ui/components/popover";
import { cn } from "@ui/lib/cn";
import { parts, testid, type TestIdProps } from "@ui/lib/testid";

const ISO = "yyyy-MM-dd";
const TYPED = "dd/MM/yyyy";

export const toIsoDate = (date: Date): string => format(date, ISO);

export function parseTypedDate(value: string): Date | null {
  const parsed = parse(value, TYPED, new Date());

  return isValid(parsed) && format(parsed, TYPED) === value ? parsed : null;
}

export function fromIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, ISO, new Date());
  return isValid(parsed) ? parsed : undefined;
}

export interface DatePickerProps extends TestIdProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly min?: string | undefined;
  readonly hasError?: boolean | undefined;
  readonly className?: string | undefined;
}

export function DatePicker({
  id,
  value,
  onChange,
  label,
  disabled = false,
  min,
  hasError = false,
  className,
  "data-testid": testId,
}: DatePickerProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const picker = usePickerOpen();
  const id_ = testId ?? id;
  const part = parts("date-picker", id_);
  const selected = fromIsoDate(value);
  const earliest = fromIsoDate(min);
  const [outOfRange, setOutOfRange] = useState(false);
  const [typed, setTyped] = useState(() => (selected ? format(selected, TYPED) : ""));

  const display = selected ? format(selected, TYPED) : "";
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setTyped(display);
    setOutOfRange(false);
  }

  const commit = (text: string): void => {
    setTyped(text);
    setOutOfRange(false);

    if (text.trim() === "") {
      onChange("");
      return;
    }

    const parsed = parseTypedDate(text);
    if (parsed && min !== undefined && toIsoDate(parsed) < min) {
      setOutOfRange(true);
      return;
    }

    if (parsed) {
      onChange(toIsoDate(parsed));
    }
  };

  return (
    <Popover
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      {...part("popover")}
      anchor={
        <div
          {...part()}
          className={cn(fieldShell({ hasError: hasError || outOfRange, disabled }), className)}
        >
          <input
            id={id}
            {...part("input")}
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={hasError || outOfRange || undefined}
            placeholder={t("common.placeholders.date")}
            value={typed}
            onChange={(event) => commit(event.target.value)}
            {...picker.opens(false)}
            onKeyDown={openOnArrowDown(picker.show)}
            className={cn(FIELD_TEXT, "page-rtl:text-right page-ltr:text-left", "tabular-nums")}
          />

          {disabled ? (
            <FieldLock {...part("lock")} />
          ) : (
            <button
              type="button"
              {...part("trigger")}
              aria-label={t("common.openCalendar")}
              {...picker.opens(true)}
              className={FIELD_BUTTON}
            >
              <Icon name="calendar" className="size-4" />
            </button>
          )}
        </div>
      }
    >
      <Calendar
        mode="single"
        {...(selected && { selected, defaultMonth: selected })}
        {...(earliest && { disabled: { before: earliest }, startMonth: earliest })}
        onSelect={(date: Date | undefined) => {
          if (date) {
            onChange(toIsoDate(date));
            picker.onOpenChange(false);
          }
        }}
      />

      <div
        data-part="picker-footer"
        {...testid(id_, "footer")}
        className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2"
      >
        <Button
          size="sm"
          variant="quiet"
          icon={<Icon name="x" />}
          {...testid(id_, "clear")}
          onClick={() => {
            onChange("");
            picker.onOpenChange(false);
          }}
        >
          {t("common.clear")}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="calendar" />}
          {...testid(id_, "today")}
          onClick={() => {
            onChange(toIsoDate(new Date()));
            picker.onOpenChange(false);
          }}
        >
          {t("common.today")}
        </Button>
      </div>

      <p className="sr-only">
        {selected ? format(selected, "PPP", { locale: dateLocale(i18n.language) }) : ""}
      </p>
    </Popover>
  );
}
