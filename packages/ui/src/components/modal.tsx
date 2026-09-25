import * as Dialog from "@radix-ui/react-dialog";
import { useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DialogLayerProvider } from "@ui/components/dialog-layer";
import { cn } from "@ui/lib/cn";
import { documentDirection } from "@ui/lib/direction";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface ModalProps extends TestIdProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleValues?: Record<string, string | number> | undefined;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  size?: "md" | "lg" | "form" | undefined;
}

// Nothing is focused when it opens: Radix's default put a caret in every dialog's first field,
// unfolding a date picker over an untouched form. The trap and Escape are unchanged.
export function Modal({
  open,
  onOpenChange,
  title,
  titleValues,
  description,
  children,
  footer,
  size = "md",
  "data-testid": testId,
}: ModalProps): JSX.Element {
  const { t } = useTranslation();
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const part = parts("modal", testId);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          {...part("overlay")}
          className={cn(
            "fixed inset-0 z-40 bg-ink/40",
            "data-[state=open]:animate-[fade-in_200ms_ease-out]",
            "data-[state=closed]:animate-[fade-out_150ms_ease-in]",
          )}
        />
        <Dialog.Content
          ref={setLayer}
          {...part()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          // `-1` so the container can hold focus without entering the tab
          // order; the first Tab moves on to the first field.
          tabIndex={-1}
          // It renders on `document.body` and inherits the page's direction — it used to say `rtl`
          // outright, which put every English form's labels and icons on the right.
          dir={documentDirection()}
          className={cn(
            // Physical centring: `translate-x` is not mirrored in RTL, so the
            // logical `start-*` variant would push the dialog off centre.
            "fixed left-1/2 top-1/2 z-50 w-[calc(100dvw-2rem)] -translate-x-1/2 -translate-y-1/2",
            size === "lg" ? "max-w-2xl" : size === "form" ? "max-w-(--form-max)" : "max-w-md",
            "flex max-h-[calc(100dvh-4rem)] flex-col rounded-card border border-line bg-surface p-5 shadow-float",
            "data-[state=open]:animate-[modal-in_160ms_ease-out]",
            "data-[state=closed]:animate-[modal-out_120ms_ease-in]",
          )}
        >
          <Dialog.Title {...part("title")} className="text-section font-medium text-ink">
            {t(title, titleValues ?? {})}
          </Dialog.Title>

          {description !== undefined ? (
            <Dialog.Description {...part("description")} className="mt-1 text-meta text-ink-muted">
              {t(description)}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">
              {t(title, titleValues ?? {})}
            </Dialog.Description>
          )}

          {/* The focus ring is 2px with a 2px offset, so a field flush against a scroll container's
              edge is clipped; the inner padding and negative margin give it room. */}
          <div
            {...part("body")}
            className="scroll-lane -mx-1.5 mt-4 flex-1 overflow-y-auto px-1.5 py-1.5"
          >
            {/* Date and time pickers inside a dialog portal into it rather than
                into the inert body — see `DialogLayerProvider`. */}
            <DialogLayerProvider container={layer}>{children}</DialogLayerProvider>
          </div>

          {footer !== undefined && (
            <div
              {...part("footer")}
              className="mt-5 flex shrink-0 items-center justify-end gap-2 border-t border-line pt-4"
            >
              <DialogLayerProvider container={layer}>{footer}</DialogLayerProvider>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
