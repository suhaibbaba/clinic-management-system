import * as SelectPrimitive from '@radix-ui/react-select';
import type { ChangeEvent, JSX, SelectHTMLAttributes } from 'react';

import { useDialogLayer } from '@ui/components/dialog-layer';
import { FieldLock, fieldShell } from '@ui/components/field';
import { Icon } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';
import { documentDirection } from '@ui/lib/direction';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  options: readonly SelectOption[];
  /** Shown while nothing is chosen, and offered as the way back to nothing. */
  placeholder?: string | undefined;
  value?: string | undefined;
  // The native signature, kept deliberately: a caller wants `event.target.value`, and Radix's
  // `onValueChange` would have meant touching thirty call sites.
  onChange?: ((event: ChangeEvent<HTMLSelectElement>) => void) | undefined;
  onBlur?: (() => void) | undefined;
  hasError?: boolean | undefined;
}

// `<Select.Item value="">` throws by design, so the placeholder row travels under a sentinel and
// comes back out as the `''` every caller already uses.
const NONE = '__none__';

// Not a native `<select>`: on a clinic's iPhone tapping one did nothing in Safari, and a native
// picker cannot be tested off the device. Radix gives ordinary DOM a test can drive.
export function Select({
  options,
  placeholder,
  className,
  hasError = false,
  value,
  onChange,
  disabled = false,
  onBlur,
  id,
  required,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: SelectProps): JSX.Element {
  // Radix Dialog makes the body inert, so a listbox portalled to `document.body` from inside one
  // ignores every click. A no-op elsewhere.
  const dialogLayer = useDialogLayer();
  // Always controlled, `NONE` standing in for "nothing chosen": leaving `value` off would make it
  // uncontrolled until the first choice, and a form reset could not clear it.
  const empty = value === '' || value === undefined;

  const emit = (next: string): void => {
    const chosen = next === NONE ? '' : next;

    // Enough of a change event for what a caller reads off it: `target.value`
    // is the entire contract every one of them uses.
    onChange?.({
      target: { value: chosen },
      currentTarget: { value: chosen },
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <SelectPrimitive.Root
      // The list portals onto `document.body` and inherits nothing from the form, so the direction
      // is read off `<html>` and passed in.
      dir={documentDirection()}
      value={empty ? NONE : value}
      onValueChange={emit}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-part="select"
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        aria-invalid={hasError || undefined}
        className={cn(
          fieldShell({ hasError, disabled }),
          'cursor-pointer text-start text-field',
          'focus-visible:outline-none',
          disabled && 'text-ink-faint',
          className,
        )}
      >
        {/* The value truncates and the chevron does not: a long doctor's name ellipsises rather
            than pushing the chevron out of the field. */}
        <span
          data-part="select-value"
          className={cn(
            'min-w-0 flex-1 truncate',
            // Ours rather than `data-[placeholder]`: the empty state is a real selection here, so
            // Radix does not consider the trigger to be showing a placeholder.
            disabled ? 'text-ink-faint' : empty ? 'text-ink-subtle' : 'text-ink',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>

        {disabled ? (
          <FieldLock />
        ) : (
          <SelectPrimitive.Icon asChild>
            <Icon
              name="chevron-down"
              data-part="select-chevron"
              className={cn(
                'size-4 shrink-0 transition-colors duration-150',
                hasError ? 'text-danger-600' : 'text-ink-faint',
              )}
            />
          </SelectPrimitive.Icon>
        )}
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <SelectPrimitive.Content
          data-part="select-list"
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-[min(24rem,var(--radix-select-content-available-height))]',
            'w-[var(--radix-select-trigger-width)] overflow-hidden rounded-panel border border-line bg-surface p-1 shadow-float',
            'origin-(--radix-select-content-transform-origin)',
            'data-[state=open]:animate-[menu-in_150ms_ease-out]',
            'data-[state=closed]:animate-[menu-out_150ms_ease-in]',
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-ink-subtle">
            <Icon name="chevron-up" className="size-4" />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport>
            {placeholder !== undefined && <Row value={NONE} label={placeholder} muted />}

            {options.map((option) => (
              <Row key={option.value} value={option.value} label={option.label} />
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-ink-subtle">
            <Icon name="chevron-down" className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function Row({
  value,
  label,
  muted = false,
}: {
  readonly value: string;
  readonly label: string;
  readonly muted?: boolean | undefined;
}): JSX.Element {
  return (
    <SelectPrimitive.Item
      value={value}
      data-part="select-option"
      className={cn(
        'flex min-h-(--control-h) cursor-pointer items-center justify-between gap-2 rounded-control',
        'lg:min-h-(--control-h-sm) px-3 py-2 text-start text-field outline-none select-none',
        // `data-highlighted` rather than `hover:`, because it is the keyboard's
        // row as much as the pointer's.
        'transition-colors duration-150',
        'data-[highlighted]:bg-inset data-[state=checked]:font-medium',
        muted ? 'text-ink-subtle' : 'text-ink',
      )}
    >
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>

      <SelectPrimitive.ItemIndicator asChild>
        <Icon name="check" data-part="select-tick" className="size-4 shrink-0 text-primary-600" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
