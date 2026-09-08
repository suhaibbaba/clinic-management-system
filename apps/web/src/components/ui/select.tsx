import { forwardRef, type ChangeEvent, type SelectHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui/icon';
import { usePickerOpen } from '@web/components/ui/picker-open';
import { PopoverSheet } from '@web/components/ui/popover-sheet';
import { cn } from '@web/lib/cn';
import { useIsMobile } from '@web/lib/use-media-query';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  /** Rendered as the first entry when the field has no value yet. */
  placeholder?: string | undefined;
  hasError?: boolean | undefined;
}

/**
 * The field's own look, shared by both shapes below so they are the same
 * control to look at — one row of fields must not have one member of it
 * drawn a step differently because of what device it is on.
 */
const FIELD = [
  'block h-11 w-full cursor-pointer appearance-none rounded-control border bg-surface lg:h-10',
  'ps-3.5 pe-10 text-start text-field text-ink',
  'transition-[border-color,box-shadow,background-color] duration-150',
  'focus:border-primary-500',
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
];

/** Our chevron, at the inline end, never in the way of a tap. */
function Chevron(): React.JSX.Element {
  return (
    <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-ink-subtle">
      <Icon name="chevron-down" />
    </span>
  );
}

/**
 * A choice of one, from a list.
 *
 * **On a pointer device this is a native `<select>`**, and for the reasons it
 * always was: it mirrors correctly in RTL, is keyboard accessible with no code
 * of ours, and stays trivially testable. The platform's own arrow is removed
 * (`appearance-none`) and replaced, because it is a different glyph on every
 * OS, always sits on the left, and cannot take the app's ink colour.
 *
 * **On a narrow screen it is the app's own sheet instead.** Reported from a
 * clinic's iPhone: tapping a dropdown did nothing at all, on every screen, in
 * Safari — the field is there, enabled, uncovered and populated, and the
 * platform picker simply never came up. That failure cannot be reproduced or
 * regression-tested anywhere but on the device, because a native picker is not
 * part of the page; so rather than guess at which quirk of it we had tripped,
 * the phone stops depending on it. What opens is the same bottom sheet the
 * date and time pickers already open there (`PopoverSheet`), which is ordinary
 * DOM: it can be tested at 390px like everything else, its rows are a full
 * touch target rather than a wheel, it draws Arabic option text in the app's
 * own type, and it ticks the value that is currently set.
 *
 * The two shapes take the same props and emit the same `onChange`, so no
 * caller knows which one it has.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(props, ref) {
  const isMobile = useIsMobile();

  return isMobile ? <SheetSelect {...props} /> : <NativeSelect ref={ref} {...props} />;
});

const NativeSelect = forwardRef<HTMLSelectElement, SelectProps>(function NativeSelect(
  { options, placeholder, className, hasError = false, ...props },
  ref,
) {
  return (
    /*
     * `className` sizes the *wrapper*, and the field fills it.
     *
     * The chevron is positioned against this element, so putting a width on
     * the `<select>` instead left the two at different widths: a `w-56`
     * currency field on a full-width row drew its arrow four hundred pixels
     * to the right of the box it belongs to. Every caller passes width or
     * margin here, which is a property of the control as a whole anyway.
     */
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(FIELD, hasError ? 'border-danger-500' : 'border-line')}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <Chevron />
    </div>
  );
});

/**
 * The same control as a button and a sheet of rows.
 *
 * The value still travels as a `change` event carrying `target.value`, because
 * that is what thirty call sites already read and there is no reason for any of
 * them to learn a second shape for the same fact.
 */
function SheetSelect({
  options,
  placeholder,
  className,
  hasError = false,
  value,
  onChange,
  disabled = false,
  id,
  required,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: SelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const picker = usePickerOpen();

  const current = options.find((option) => option.value === value);
  const label = ariaLabel ?? placeholder ?? t('common.choose');

  const choose = (next: string): void => {
    picker.onOpenChange(false);
    // Enough of a change event for what a caller reads off it. Synthesising the
    // whole of React's is neither possible nor useful: `target.value` is the
    // entire contract every one of them uses.
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <PopoverSheet
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      anchor={
        <div className={cn('relative', className)}>
          {/* Only the attributes that mean the same thing on a button: the
              rest of `SelectHTMLAttributes` belongs to a control this is not,
              and forwarding them wholesale would be a lie in the DOM. */}
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-required={required || undefined}
            aria-label={ariaLabel}
            aria-describedby={describedBy}
            aria-invalid={hasError || undefined}
            {...picker.opens(true)}
            className={cn(
              FIELD,
              'flex items-center',
              current === undefined && 'text-ink-subtle',
              hasError ? 'border-danger-500' : 'border-line',
            )}
          >
            <span className="truncate">{current?.label ?? placeholder ?? ''}</span>
          </button>

          <Chevron />
        </div>
      }
    >
      <ul aria-label={label} className="max-h-[60vh] w-full overflow-y-auto">
        {placeholder !== undefined && (
          <Row label={placeholder} selected={current === undefined} onSelect={() => choose('')} />
        )}

        {options.map((option) => (
          <Row
            key={option.value}
            label={option.label}
            selected={option.value === value}
            onSelect={() => choose(option.value)}
          />
        ))}
      </ul>
    </PopoverSheet>
  );
}

function Row({
  label,
  selected,
  onSelect,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        // `aria-current`, like the time list's rows: this is a sheet of
        // buttons rather than a listbox widget, and claiming otherwise would
        // promise a keyboard model it does not implement.
        aria-current={selected || undefined}
        onClick={onSelect}
        className={cn(
          // 44px of row, because this is a thumb's target and the reason the
          // sheet exists at all.
          'flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-control',
          'px-3 py-2 text-start text-value transition-colors duration-150',
          selected ? 'bg-primary-600 text-ink-inverse' : 'text-ink hover:bg-inset',
        )}
      >
        <span className="truncate">{label}</span>
        {selected && <Icon name="check" className="size-4 shrink-0" />}
      </button>
    </li>
  );
}
