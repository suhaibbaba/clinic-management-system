import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useRef, type JSX, type ReactNode } from "react";
import { useDialogLayer } from "@ui/components/dialog-layer";
import { cn } from "@ui/lib/cn";

export interface PopoverProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly anchor: ReactNode;
  readonly title: string;
  // `false` is for a picker that appeared because somebody clicked the text field: moving focus
  // there would swallow the first keystroke.
  readonly focusOnOpen?: boolean | undefined;
  /** Sizing and padding only — the card's border, shadow and animation are the primitive's. */
  readonly className?: string | undefined;
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
  className,
  children,
}: PopoverProps): JSX.Element {
  // Radix Dialog makes the body inert, so a popover portalled to `document.body` from inside one
  // renders and ignores every click. Portalling into the dialog is a no-op elsewhere.
  const dialogLayer = useDialogLayer();
  // Radix excludes a `Trigger` from its outside-click dismissal but not an `Anchor`, so without
  // this a click in the field a picker hangs off closes the panel the same click means to use.
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Anchor asChild ref={anchorRef}>
        {anchor}
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <PopoverPrimitive.Content
          data-part="popover"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={title}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) {
              event.preventDefault();
            }
          }}
          {...(!focusOnOpen && {
            onOpenAutoFocus: (event: Event) => event.preventDefault(),
          })}
          className={cn(
            "z-50 max-h-[min(32rem,var(--radix-popover-content-available-height))] overflow-y-auto",
            "rounded-card border border-line bg-surface p-3 shadow-float",
            "origin-(--radix-popover-content-transform-origin)",
            "data-[state=open]:animate-[menu-in_150ms_ease-out]",
            "data-[state=closed]:animate-[menu-out_150ms_ease-in]",
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
