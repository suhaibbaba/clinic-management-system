import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { JSX, ReactNode } from 'react';

import { useDialogLayer } from '@web/components/ui/dialog-layer';
import { cn } from '@web/lib/cn';

export interface PopoverProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  // An anchor, not a trigger: it positions and nothing else, and opening is the caller's from an
  // explicit click, Enter, Space or ArrowDown.
  readonly anchor: ReactNode;
  readonly title: string;
  // `false` is for a picker that appeared because somebody clicked the text field: moving focus
  // there would swallow the first keystroke.
  readonly focusOnOpen?: boolean | undefined;
  readonly children: ReactNode;
}

// One shape on every screen — it used to be a bottom sheet below `md`, a second primitive for one
// question. The field anchors rather than triggers, so nothing opens it by accident.
export function Popover({
  open,
  onOpenChange,
  anchor,
  title,
  focusOnOpen = true,
  children,
}: PopoverProps): JSX.Element {
  // Radix Dialog makes the body inert, so a popover portalled to `document.body` from inside one
  // renders and ignores every click. Portalling into the dialog is a no-op elsewhere.
  const dialogLayer = useDialogLayer();

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Anchor asChild>{anchor}</PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={title}
          {...(!focusOnOpen && {
            onOpenAutoFocus: (event: Event) => event.preventDefault(),
          })}
          className={cn(
            // Constrained to what is on screen, so a field near the bottom of a 390px phone gets a
            // calendar that scrolls rather than one cut off.
            'z-50 max-h-[min(32rem,var(--radix-popover-content-available-height))] overflow-y-auto',
            'rounded-card bg-surface p-3 shadow-float',
            'origin-(--radix-popover-content-transform-origin)',
            'data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out',
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
