import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { JSX, ReactNode } from 'react';

import { useDialogLayer } from '@web/components/ui/dialog-layer';
import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';
import { useIsMobile } from '@web/lib/use-media-query';

export interface PopoverSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * The control this hangs off — an **anchor**, not a trigger.
   *
   * It positions the popover and nothing else: opening is the caller's, from
   * an explicit click, Enter, Space or ArrowDown on a control it owns. See the
   * note on the component.
   */
  readonly anchor: ReactNode;
  /** The sheet's heading, and the popover's accessible name. */
  readonly title: string;
  /**
   * Whether the popover takes focus when it opens. Default `true`.
   *
   * `false` is for the one case where it must not: a picker that appeared
   * because somebody clicked the text field it belongs to, where they are
   * about to type. Moving focus there would swallow the first keystroke.
   *
   * Desktop only. The narrow-screen sheet is a dialog — it covers the page and
   * traps focus — and a dialog that does not take focus is a trap with nobody
   * in it.
   */
  readonly focusOnOpen?: boolean | undefined;
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
 *
 * **The field anchors this; it does not trigger it.** Radix's `Trigger` wraps
 * the node it is given and opens on any activation of it, which for a date or
 * time field means the calendar can come up from something the user did not
 * mean as "show me a calendar" — most visibly when a dialog opens and hands
 * focus to its first field, where a picker unfolding over a form nobody has
 * touched yet is the bug this replaced. `Anchor` positions and stays silent,
 * and each caller says for itself what opens it: a click on the field or on
 * the button at the end of it, Enter or Space on that button, ArrowDown from
 * the field — and never focus. See `usePickerOpen`.
 */
export function PopoverSheet({
  open,
  onOpenChange,
  anchor,
  title,
  focusOnOpen = true,
  children,
}: PopoverSheetProps): JSX.Element {
  const isMobile = useIsMobile();
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

  if (isMobile) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        {/* Rendered plainly: on a phone the field opens the sheet from its
            own button, exactly as it does on a laptop. */}
        {anchor}

        <DialogPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
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
      <PopoverPrimitive.Anchor asChild>{anchor}</PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          aria-label={title}
          {...(!focusOnOpen && {
            onOpenAutoFocus: (event: Event) => event.preventDefault(),
          })}
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
