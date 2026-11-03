import type { SiteBlock, SitePageKind } from "@clinic/shared";
import type { JSX } from "react";
import { SiteBlockView } from "@web/site/blocks/site-block-view";
import { BLOCK_BODY_CLASS, BODY_BLOCKS } from "@web/site/constants";

export function BlockSlot({
  block,
  kind,
}: {
  readonly block: SiteBlock;
  readonly kind: SitePageKind;
}): JSX.Element {
  return BODY_BLOCKS.has(block.type) ? (
    <div data-block={block.type} className={BLOCK_BODY_CLASS}>
      <SiteBlockView block={block} kind={kind} />
    </div>
  ) : (
    <SiteBlockView block={block} kind={kind} />
  );
}
