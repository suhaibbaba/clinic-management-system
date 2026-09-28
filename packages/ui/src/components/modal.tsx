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
          tabIndex={-1}
          dir={documentDirection()}
          className={cn(
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

          <div
            {...part("body")}
            className="scroll-lane -mx-1.5 mt-4 flex-1 overflow-y-auto px-1.5 py-1.5"
          >
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
