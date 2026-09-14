import type { JSX } from 'react';

import { Icon, type IconName } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';

export interface FieldState {
  readonly hasError?: boolean | undefined;
  readonly disabled?: boolean | undefined;
}

/**
 * The box every field draws — input, select, search, both pickers. Six states, and each one is the
 * edge and the fill; the geometry never moves between them.
 */
export function fieldShell({ hasError = false, disabled = false }: FieldState): string {
  return cn(
    'group flex w-full items-center gap-2 rounded-control border-[1.5px] px-3.5',
    'h-(--control-h) transition-[border-color,box-shadow,background-color] duration-150',
    // Disabled is a solid fill with no edge at all: it has to be readable as unavailable from the
    // shape alone, before anyone notices the cursor or the lock.
    disabled && 'cursor-not-allowed border-transparent bg-inset',
    !disabled && 'bg-surface',
    !disabled &&
      hasError &&
      'border-danger-600 shadow-field-error focus-within:shadow-field-error-ring',
    !disabled &&
      !hasError &&
      cn(
        'border-line-strong hover:border-neutral-400',
        'focus-within:border-primary-600 focus-within:shadow-field-focus',
      ),
  );
}

/**
 * The value inside the shell: it truncates, so the adornments beside it never move. `self-stretch`
 * because the shell is the 44px target and the input is a 22px line box inside it — without it a
 * tap in the top or bottom 10px of every field in the app landed on nothing.
 */
export const FIELD_TEXT = cn(
  'min-w-0 flex-1 self-stretch truncate border-none bg-transparent p-0 text-field text-ink outline-none',
  'placeholder:text-ink-subtle',
  'disabled:cursor-not-allowed disabled:text-ink-faint',
);

export interface FieldIconProps extends FieldState {
  readonly name: IconName;
}

// The start icon carries the state with the border: primary while the field has the caret, danger
// while it is wrong. `group-focus-within` rather than a prop, so no field tracks its own focus.
export function FieldIcon({
  name,
  hasError = false,
  disabled = false,
}: FieldIconProps): JSX.Element {
  return (
    <Icon
      name={name}
      data-part="field-icon"
      aria-hidden="true"
      className={cn(
        'size-4 shrink-0 transition-colors duration-150',
        hasError ? 'text-danger-600' : 'text-ink-faint',
        !disabled && !hasError && 'group-focus-within:text-primary-600',
      )}
    />
  );
}

/** The icon button a picker puts at the field's end — the field itself is the 44px thumb target. */
export const FIELD_BUTTON = cn(
  'inline-grid size-6 shrink-0 cursor-pointer place-items-center rounded-chip',
  'text-ink-faint transition-colors duration-150 hover:bg-inset hover:text-ink',
);

/** The lock that names a disabled field, beside the fill that already said so. */
export function FieldLock(): JSX.Element {
  return (
    <Icon
      name="lock"
      data-part="field-lock"
      aria-hidden="true"
      className="size-4 shrink-0 text-ink-faint"
    />
  );
}

export interface FieldClearProps {
  readonly label: string;
  readonly onClear: () => void;
}

// A button, not a glyph: emptying a field is an action, and reception does it with a thumb.
export function FieldClear({ label, onClear }: FieldClearProps): JSX.Element {
  return (
    <button
      type="button"
      data-part="field-clear"
      aria-label={label}
      onClick={onClear}
      className={cn(
        'inline-grid size-5 shrink-0 cursor-pointer place-items-center rounded-pill',
        'text-ink-faint transition-colors duration-150 hover:bg-inset hover:text-ink',
      )}
    >
      <Icon name="x" className="size-3.5" />
    </button>
  );
}
