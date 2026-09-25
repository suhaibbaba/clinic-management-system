import { useCallback, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/components/button";
import { Icon } from "@ui/components/icon";
import { Modal } from "@ui/components/modal";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface ConfirmDialogProps extends TestIdProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** A key naming the thing, e.g. `visits.confirmDelete.title` with its date. */
  readonly title: string;
  readonly titleValues?: Record<string, string | number> | undefined;
  /** Already worded: what goes with it, one line each. */
  readonly consequences?: readonly ReactNode[] | undefined;
  readonly confirmLabel?: string | undefined;
  /** Resolves to close; a rejection keeps the dialog open for the caller's own error. */
  readonly onConfirm: () => Promise<void>;
}

// One dialog for every destructive action. Nothing is focused on open, as with every dialog, so the
// irreversible button is never what Enter reaches first; Escape cancels.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  titleValues,
  consequences,
  confirmLabel = "common.deleteForever",
  onConfirm,
  "data-testid": testId = "confirm-dialog",
}: ConfirmDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const confirm = async (): Promise<void> => {
    setBusy(true);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller has already said why; the dialog stays for another try or a cancel.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={title}
      titleValues={titleValues}
      footer={
        <>
          <Button
            variant="secondary"
            icon={<Icon name="x" />}
            {...testid(testId, "cancel")}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="trash" />}
            {...testid(testId, "confirm")}
            isLoading={busy}
            onClick={() => void confirm()}
          >
            {t(confirmLabel)}
          </Button>
        </>
      }
    >
      {consequences && consequences.length > 0 ? (
        <ul {...testid(testId, "consequences")} className="flex flex-col gap-1.5">
          {consequences.map((line, index) => (
            <li key={index} className="flex items-start gap-2 text-value text-ink-muted">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-danger-600" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <></>
      )}
    </Modal>
  );
}

export type ConfirmRequest = Pick<
  ConfirmDialogProps,
  "title" | "titleValues" | "consequences" | "confirmLabel" | "onConfirm"
>;

/** A destructive action asks through this: call `confirm`, render `dialog` once. */
export function useConfirm(testId?: string): {
  readonly confirm: (request: ConfirmRequest) => void;
  readonly dialog: JSX.Element;
} {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), []);

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        {...(testId !== undefined && { "data-testid": testId })}
        open={request !== null}
        onOpenChange={(open) => !open && setRequest(null)}
        title={request?.title ?? ""}
        titleValues={request?.titleValues}
        consequences={request?.consequences}
        confirmLabel={request?.confirmLabel}
        onConfirm={request?.onConfirm ?? (async () => undefined)}
      />
    ),
  };
}
