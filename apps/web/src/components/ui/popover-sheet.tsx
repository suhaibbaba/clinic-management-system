import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { JSX, ReactNode } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';
import { useIsMobile } from '@web/lib/use-media-query';

export interface PopoverSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The control this hangs off. */
  readonly trigger: ReactNode;
  /** The sheet's heading, and the popover's accessible name. */
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * A popover on a wide screen; a bottom sheet on a narrow one.
 *
 * The first attempt was one Radix `Popover` re-positioned by CSS below `md`,
 * which does not work: Radix puts its positioning on a *wrapper* element that
 * a consumer cannot style, so `position: fixed; bottom: 0` on the content sat
 * inside a wrapper still anchored to the trigger — the sheet came out as a
 * clipped strip beside the field. Two primitives, one open state.
 *
 * That split is also the more honest one. On a phone this really is a dialog:
 * it covers the page, takes a scrim, traps focus and has a heading and a close
 * button. On a laptop it is a popover, dismissed by looking away. Both take
 * their open state from the caller, so nothing behaves differently between the
 * two beyond what the shape implies.
 */
export function PopoverSheet({
  open,
  onOpenChange,
  trigger,
  title,
  children,
}: PopoverSheetProps): JSX.Element {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />

          <DialogPrimitive.Content
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto',
              'rounded-t-card bg-surface p-4 pb-8 shadow-float',
              'data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out',
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <DialogPrimitive.Title className="text-value font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>

              <DialogPrimitive.Close
                aria-label={title}
                className={cn(
                  'cursor-pointer rounded-control p-1.5 text-ink-muted',
                  'transition-colors duration-150 hover:bg-inset hover:text-ink',
                )}
              >
                <Icon name="x" />
              </DialogPrimitive.Close>
            </div>

            {/*
              A column, not a row: the calendar and the buttons under it are
              siblings, and `flex` alone laid them out side by side and pushed
              the grid off the edge of a 390px screen.
            */}
            <div className="flex flex-col items-center">{children}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          aria-label={title}
          className={cn(
            'z-50 rounded-card bg-surface p-3 shadow-float',
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
