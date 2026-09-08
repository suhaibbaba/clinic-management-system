import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { JSX, ReactNode } from 'react';

import { useDialogLayer } from '@web/components/ui/dialog-layer';
import { cn } from '@web/lib/cn';

export interface PopoverProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * The control this hangs off — an **anchor**, not a trigger.
   *
   * It positions the popover and nothing else: opening is the caller's, from
   * an explicit click, Enter, Space or ArrowDown on a control it owns. See
   * `usePickerOpen`.
   */
  readonly anchor: ReactNode;
  /** The popover's accessible name. */
  readonly title: string;
  /**
   * Whether it takes focus when it opens. Default `true`.
   *
   * `false` is for the one case where it must not: a picker that appeared
   * because somebody clicked the text field it belongs to, where they are
   * about to type. Moving focus there would swallow the first keystroke.
   */
  readonly focusOnOpen?: boolean | undefined;
  readonly children: ReactNode;
}

/**
 * The layer a picker opens into.
 *
 * One shape on every screen, which is the point. It used to be a popover on a
 * wide screen and a bottom sheet on a narrow one — two primitives and two sets
 * of behaviour for one question — and that split stopped earning its keep the
 * moment `Select` became a single Radix control on every platform: a date
 * field that answers one way on a laptop and another on a phone is the kind of
 * inconsistency people read as a bug even when both halves work.
 *
 * **The field anchors this; it does not trigger it.** Radix's `Trigger` wraps
 * the node it is given and opens on any activation of it, which for a date or
 * time field means the calendar can come up from something the user did not
 * mean as "show me a calendar" — most visibly when a dialog opens and hands
 * focus to its first field. `Anchor` positions and stays silent, and each
 * caller says for itself what opens it.
 */
export function Popover({
  open,
  onOpenChange,
  anchor,
  title,
  focusOnOpen = true,
  children,
}: PopoverProps): JSX.Element {
  /*
   * A dialog above us, if any.
   *
   * Radix Dialog makes the body inert while it is open, so a popover portalled
   * to `document.body` from inside one renders perfectly and ignores every
   * click — which is what the date range picker in the "add a closure" dialog
   * did. Portalling into the dialog's own content keeps it interactive, and is
   * a no-op everywhere else.
   */
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
            // Constrained to what is actually on screen, so a field near the
            // bottom of a 390px phone gets a calendar that scrolls rather than
            // one with its last week cut off.
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
