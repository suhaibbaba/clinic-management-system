import { insertableBlocks, type SiteBlockType, type SitePageKind } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Icon, Modal } from "@clinic/ui";

export function BlockLibrary({
  kind,
  open,
  onOpenChange,
  onPick,
}: {
  readonly kind: SitePageKind;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPick: (type: SiteBlockType) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <Modal
      data-testid="block-library"
      open={open}
      onOpenChange={onOpenChange}
      title="website.editor.library.title"
      description="website.editor.library.description"
      size="lg"
    >
      <ul data-testid="block-library-list" className="grid gap-2 sm:grid-cols-2">
        {insertableBlocks(kind).map((type) => (
          <li key={type}>
            <button
              type="button"
              data-testid={`block-library-${type}`}
              onClick={() => onPick(type)}
              className="flex h-full w-full cursor-pointer items-start gap-3 rounded-panel border border-line bg-surface p-3 text-start hover:border-primary-600 hover:bg-inset focus-visible:border-primary-600"
            >
              <Icon name="plus" className="mt-0.5 shrink-0 text-primary-700" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-value font-medium text-ink">
                  {t(`website.editor.blocks.${type}.name`)}
                </span>
                <span className="text-label text-ink-muted">
                  {t(`website.editor.blocks.${type}.description`)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
