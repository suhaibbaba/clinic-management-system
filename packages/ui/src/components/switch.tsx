import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { JSX } from 'react';

import { cn } from '@ui/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean | undefined;
  id?: string | undefined;
}

/** The knob is positioned with logical offsets, so it slides the correct way in RTL. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  id,
}: SwitchProps): JSX.Element {
  return (
    <SwitchPrimitive.Root
      data-part="switch"
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full',
        'transition-colors duration-150',
        // `after` rather than padding for the 44px target: padding would move the thumb's own
        // anchor and grow the track with it.
        'after:absolute after:inset-x-0 after:top-1/2 after:h-(--control-h) after:-translate-y-1/2',
        'after:content-[""] lg:after:hidden',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary-600' : 'bg-neutral-300',
      )}
    >
      <SwitchPrimitive.Thumb
        data-part="switch-thumb"
        className={cn(
          'block size-5 rounded-full bg-surface shadow-pill transition-transform',
          'absolute top-0.5 start-0.5',
          checked ? 'rtl:-translate-x-5 ltr:translate-x-5' : 'translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
