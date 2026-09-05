import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { JSX } from 'react';

import { cn } from '@web/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name; the caller passes an already-translated string. */
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
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-gray-300',
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-5 rounded-full bg-white shadow transition-transform',
          'absolute top-0.5 start-0.5',
          checked ? 'rtl:-translate-x-5 ltr:translate-x-5' : 'translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
