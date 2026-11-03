import { blockActions, insertableBlocks, type SiteBlock, type SitePageKind } from "@clinic/shared";
import { Fragment, type JSX } from "react";
import { BlockSlot } from "@web/site/blocks/block-slot";
import { BlockEditFrame } from "@web/site/blocks/edit/block-edit-frame";
import { BlockInsertButton } from "@web/site/blocks/edit/block-insert-button";
import { useSite } from "@web/site/hooks/use-site";

export function EditableBlocks({
  kind,
  blocks,
  editing,
}: {
  readonly kind: SitePageKind;
  readonly blocks: readonly SiteBlock[];
  readonly editing: string | null;
}): JSX.Element {
  const { siteDocument } = useSite();
  const insertable = insertableBlocks(kind).length > 0;

  return (
    <div data-testid="site-edit-blocks">
      {blocks.map((block, index) => (
        <Fragment key={block.id}>
          {insertable && index > 0 && <BlockInsertButton kind={kind} index={index} />}
          <BlockEditFrame
            kind={kind}
            block={block}
            editing={editing === block.id}
            actions={blockActions(siteDocument, kind, block.id)}
          >
            <BlockSlot block={block} kind={kind} />
          </BlockEditFrame>
        </Fragment>
      ))}
      {insertable && <BlockInsertButton kind={kind} index={blocks.length} />}
    </div>
  );
}
