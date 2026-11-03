import { SITE_PREVIEW_MESSAGE, type SitePageKind } from "@clinic/shared";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useSite } from "@web/site/hooks/use-site";
import { postToEditor } from "@web/site/lib/site-edit";

export function BlockInsertButton({
  kind,
  index,
}: {
  readonly kind: SitePageKind;
  readonly index: number;
}): JSX.Element {
  const { t } = useSite();

  return (
    <div
      data-testid={`site-block-insert-${index}`}
      className="relative z-40 flex h-0 items-center justify-center"
    >
      <button
        type="button"
        data-part="button"
        aria-label={t("editor.insert")}
        title={t("editor.insert")}
        onClick={() => postToEditor({ type: SITE_PREVIEW_MESSAGE.INSERT, kind, index })}
        className="inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center rounded-full border-2 border-surface bg-primary-600 text-ink-inverse shadow-float hover:bg-primary-700"
      >
        <Plus aria-hidden="true" focusable="false" strokeWidth={2} className="size-4" />
      </button>
    </div>
  );
}
