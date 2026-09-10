import { format } from 'date-fns';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@web/components/ui/button';
import { Calendar } from '@web/components/ui/calendar';
import { fromIsoDate, toIsoDate } from '@web/components/ui/date-picker';
import { Icon } from '@web/components/ui/icon';
import { openOnArrowDown, usePickerOpen } from '@web/components/ui/picker-open';
import { Popover } from '@web/components/ui/popover';
import { cn } from '@web/lib/cn';
import { Ltr } from '@web/components/ui/ltr';

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
  const summary =
    from || to
      ? [from ? format(from, 'dd/MM/yyyy') : '…', to ? format(to, 'dd/MM/yyyy') : '…'].join(' — ')
      : t('common.placeholders.dateRange');

  return (
    <Popover
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      anchor={
        <button
          id={id}
          type="button"
          aria-label={label}
          // This anchor is itself the control, so it opens on click, Enter and Space by being a
          // button. There is no text to type, so it takes focus every time.
          {...picker.opens(true)}
          onKeyDown={openOnArrowDown(picker.show)}
          className={cn(
            'flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-control lg:h-9',
            'border border-line bg-surface ps-3.5 pe-3 text-start text-field',
            'transition-[border-color,box-shadow] duration-150 hover:border-primary-300',
            from || to ? 'text-ink' : 'text-ink-subtle',
            className,
          )}
        >
          <Ltr className="truncate tabular-nums">{summary}</Ltr>
          <Icon name="calendar" className="text-ink-subtle" />
        </button>
      }
    >
      <Calendar
        mode="range"
        selected={from ? { from, ...(to && { to }) } : undefined}
        defaultMonth={from ?? to ?? new Date()}
        onSelect={(range) => {
          onChange({
            from: range?.from ? toIsoDate(range.from) : '',
            to: range?.to ? toIsoDate(range.to) : '',
          });
        }}
      />

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="x" />}
          onClick={() => {
            onChange({ from: '', to: '' });
            picker.onOpenChange(false);
          }}
        >
          {t('common.clear')}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          icon={<Icon name="check" />}
          onClick={() => picker.onOpenChange(false)}
        >
          {t('common.done')}
        </Button>
      </div>
    </Popover>
  );
}
