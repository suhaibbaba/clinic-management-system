import * as SelectPrimitive from '@radix-ui/react-select';
import type { ChangeEvent, JSX, SelectHTMLAttributes } from 'react';

import { useDialogLayer } from '@web/components/ui/dialog-layer';
import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';
import { documentDirection } from '@web/lib/direction';

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
  /**
   * The native signature, kept deliberately.
   *
   * Radix's own is `onValueChange(value)`, and adopting it would have meant
   * touching thirty call sites to say the same thing a different way. What a
   * caller wants off this control is `event.target.value`, which is what it
   * wanted before.
   */
  onChange?: ((event: ChangeEvent<HTMLSelectElement>) => void) | undefined;
  /** `react-hook-form`'s, to mark the field touched. */
  onBlur?: (() => void) | undefined;
  hasError?: boolean | undefined;
}

/**
 * Radix cannot hold an empty string, and this app's "nothing chosen" is one.
 *
 * `<Select.Item value="">` throws by design — the empty string is reserved for
 * clearing the selection. So the placeholder row travels under a sentinel and
 * is turned back into `''` on the way out, which keeps `''` as the value every
 * caller, every query and every query string already uses.
 */
const NONE = '__none__';

/**
 * A choice of one, from a list.
 *
 * **Not a native `<select>`.** It was, and on a clinic's iPhone tapping one did
 * nothing at all, on every screen, in Safari — the field present, enabled,
 * uncovered and populated, and the platform picker simply never arriving. A
 * native picker is not part of the page, so that failure can be neither
 * reproduced nor regression-tested anywhere but on the device. This is Radix's
 * `Select`, the primitive shadcn/ui builds the same control from: one control,
 * the same on every platform, drawn by us out of ordinary DOM that a test at
 * 390px can drive.
 *
 * What that buys beyond the bug: the list is styled like the rest of the app
 * instead of by the OS, Arabic option text is set in the app's own type, the
 * row that is set carries a tick, rows are a full 44px for a thumb, and
 * typeahead, Home/End, the arrow keys and Escape come from the primitive
 * rather than from us.
 *
 * The chevron stays ours for the reason it always was: the platform's is a
 * different glyph on every OS, always sits on the left, and cannot take the
 * app's ink colour.
 */
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
  /*
   * A dialog above us, if any.
   *
   * Radix Dialog makes the body inert while it is open, so a listbox portalled
   * to `document.body` from inside one renders perfectly and ignores every
   * click. Portalling into the dialog's own content keeps it interactive, and
   * is a no-op everywhere else — the same reason `PopoverSheet` does it.
   */
  const dialogLayer = useDialogLayer();
  /*
   * Always controlled, `NONE` standing in for "nothing chosen".
   *
   * Leaving `value` off while the field is empty is the obvious way to get
   * Radix's own placeholder handling, and it makes the control uncontrolled
   * until the first choice — React says so out loud, and a form reset then
   * cannot put it back to empty.
   */
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
      // The list portals onto `document.body`, which inherits nothing from the
      // form it belongs to — so the direction is passed in, read off `<html>`
      // where `applyLanguageToDocument` puts it.
      dir={documentDirection()}
      value={empty ? NONE : value}
      onValueChange={emit}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        // Forwarded so react-hook-form can mark the field touched, which is
        // what decides whether its error is shown yet.
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        aria-invalid={hasError || undefined}
        className={cn(
          // 44px under `lg`, like every other field a thumb has to hit.
          'flex h-11 w-full cursor-pointer items-center justify-between gap-2 lg:h-10',
          'rounded-control border bg-surface ps-3.5 pe-3 text-start text-field text-ink',
          'transition-[border-color,box-shadow,background-color] duration-150',
          'focus:border-primary-500',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
          // Ours rather than `data-[placeholder]`: the empty state is a real
          // selection here — the row that clears the field — so Radix does not
          // consider the trigger to be showing a placeholder.
          empty && 'text-ink-subtle',
          hasError ? 'border-danger-500' : 'border-line',
          className,
        )}
      >
        {/* `truncate` on the value rather than the trigger: the chevron keeps
            its room, and a long doctor's name ellipsises instead of pushing
            it out of the field. */}
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>

        <SelectPrimitive.Icon asChild>
          <Icon name="chevron-down" className="shrink-0 text-ink-subtle" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-[min(24rem,var(--radix-select-content-available-height))]',
            'w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card bg-surface p-1 shadow-float',
            'origin-(--radix-select-content-transform-origin)',
            'data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out',
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

/** One row: a full touch target, the label, and a tick when it is the one set. */
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
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-control lg:min-h-9',
        'px-3 py-2 text-start text-field outline-none select-none',
        // `data-highlighted` rather than `hover:`, because it is the keyboard's
        // row as much as the pointer's.
        'data-[highlighted]:bg-inset data-[state=checked]:font-medium',
        muted ? 'text-ink-subtle' : 'text-ink',
      )}
    >
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>

      <SelectPrimitive.ItemIndicator asChild>
        <Icon name="check" className="size-4 shrink-0 text-primary-600" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
