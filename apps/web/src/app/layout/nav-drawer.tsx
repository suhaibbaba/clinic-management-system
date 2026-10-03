import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { JSX, ReactNode } from "react";
import { Icon } from "@clinic/ui/components/icon";
import { cn } from "@clinic/ui/lib/cn";

export interface NavDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly brand: ReactNode;
  readonly closeLabel: string;
  readonly children: ReactNode;
}

export function NavDrawer({
  open,
  onOpenChange,
  title,
  brand,
  closeLabel,
  children,
}: NavDrawerProps): JSX.Element {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="nav-drawer-overlay"
          className={cn(
            "fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px] rail:hidden",
            "data-[state=open]:animate-[fade-in_200ms_ease-out]",
            "data-[state=closed]:animate-[fade-out_150ms_ease-in]",
          )}
        />

        <DialogPrimitive.Content
          data-testid="nav-drawer"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          tabIndex={-1}
          aria-label={title}
          className={cn(
            "fixed inset-y-0 start-0 z-50 flex w-[86%] max-w-[320px] flex-col rail:hidden",
            "bg-rail shadow-drawer",
            "data-[state=open]:animate-[drawer-in_220ms_cubic-bezier(0.32,0.72,0,1)]",
            "data-[state=closed]:animate-[drawer-out_180ms_ease-in]",
          )}
        >
          <div
            data-testid="nav-drawer-header"
            className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3"
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            <div className="min-w-0 flex-1">{brand}</div>

            <DialogPrimitive.Close
              data-testid="nav-drawer-close"
              aria-label={closeLabel}
              className={cn(
                "inline-flex size-(--control-h) shrink-0 cursor-pointer items-center justify-center rounded-pill",
                "text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink",
              )}
            >
              <Icon name="x" />
            </DialogPrimitive.Close>
          </div>

          <div
            data-testid="nav-drawer-body"
            className="scroll-lane min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3"
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
