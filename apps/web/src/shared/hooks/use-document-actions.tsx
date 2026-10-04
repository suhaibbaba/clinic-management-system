import { useState, type JSX } from "react";
import { useToast } from "@clinic/ui";
import { SendDocumentDialog } from "@web/shared/components/send-document-dialog";
import { errorToast } from "@web/shared/lib/api-error";
import type { DocumentSource } from "@web/shared/lib/document-source";
import { presentBlob, printBlob } from "@web/shared/lib/download";
import { useDocumentDelivery } from "@web/shared/queries/document-delivery";

export interface DocumentActions {
  readonly busy: boolean;
  readonly print: (source: DocumentSource) => void;
  readonly download: (source: DocumentSource) => void;
  readonly send: (source: DocumentSource) => void;
  readonly sendAvailable: boolean;
  readonly dialog: JSX.Element;
}

export function useDocumentActions(testId: string): DocumentActions {
  const toast = useToast();
  const delivery = useDocumentDelivery();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<DocumentSource | null>(null);

  const run = (
    source: DocumentSource,
    task: (blob: Blob, filename: string) => Promise<void>,
  ): void => {
    if (busy) {
      return;
    }

    setBusy(true);
    void source
      .load()
      .then((blob) => task(blob, source.filename))
      .catch((error: unknown) => toast.error(...errorToast(error)))
      .finally(() => setBusy(false));
  };

  return {
    busy,
    print: (source) => run(source, (blob) => printBlob(blob)),
    download: (source) => run(source, (blob, filename) => presentBlob(blob, filename, true)),
    send: (source) => {
      if (source.send) {
        setSending(source);
      }
    },
    sendAvailable: delivery.data?.available === true,
    dialog: (
      <SendDocumentDialog
        data-testid={`${testId}-send`}
        open={sending !== null}
        recipient={sending?.recipient}
        send={(to) => sending?.send?.(to) ?? Promise.resolve()}
        onClose={() => setSending(null)}
      />
    ),
  };
}
