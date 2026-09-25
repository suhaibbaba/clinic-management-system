import { useLayoutEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/components/button";
import { Modal } from "@ui/components/modal";
import { cn } from "@ui/lib/cn";
import { parts, testid, type TestIdProps } from "@ui/lib/testid";

export interface NotePreviewProps extends TestIdProps {
  readonly text: string;
  /** A key naming whose note it is, e.g. `treatmentPlans.notesOf` with the plan's title. */
  readonly title: string;
  readonly titleValues?: Record<string, string | number> | undefined;
  /** `meta` inside a row whose own lines are meta-sized. */
  readonly size?: "value" | "meta" | undefined;
  readonly className?: string | undefined;
}

/** One line of a note; the rest opens in a dialog, so a long note never stretches its card. */
export function NotePreview({
  text,
  title,
  titleValues,
  size = "value",
  className,
  "data-testid": testId = "note-preview",
}: NotePreviewProps): JSX.Element {
  const { t } = useTranslation();
  const part = parts("note-preview", testId);
  const line = useRef<HTMLParagraphElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const node = line.current;
    if (!node) {
      return;
    }

    const measure = (): void =>
      setClipped(
        text.trim().includes("\n") ||
          node.scrollWidth > node.clientWidth ||
          node.scrollHeight > node.clientHeight,
      );

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div {...part()} className={cn("flex min-w-0 items-baseline gap-2", className)}>
      <p
        ref={line}
        {...part("text")}
        className={cn(
          "min-w-0 flex-1 truncate text-ink-muted [unicode-bidi:plaintext]",
          // Plaintext bidi would otherwise push an Arabic note to the far edge on an English page.
          "page-rtl:text-right page-ltr:text-left",
          size === "meta" ? "text-meta" : "text-value",
        )}
      >
        {text.trim().split("\n")[0]}
      </p>

      {clipped && (
        <button
          type="button"
          {...part("more")}
          onClick={() => setOpen(true)}
          className="shrink-0 cursor-pointer rounded-control text-meta font-medium text-primary-700 hover:underline"
        >
          {t("common.showMore")}
        </button>
      )}

      <Modal
        {...testid(testId, "dialog")}
        open={open}
        onOpenChange={setOpen}
        title={title}
        titleValues={titleValues}
        footer={
          <Button variant="secondary" {...testid(testId, "close")} onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        }
      >
        <p className="whitespace-pre-wrap text-value text-ink [unicode-bidi:plaintext]">{text}</p>
      </Modal>
    </div>
  );
}
