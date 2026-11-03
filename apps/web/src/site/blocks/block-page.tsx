import { siteDocumentPage, type SitePageKind } from "@clinic/shared";
import { lazy, Suspense, type JSX } from "react";
import { BlockSlot } from "@web/site/blocks/block-slot";
import { useSite } from "@web/site/hooks/use-site";

const EditableBlocks = lazy(async () => {
  const module = await import("@web/site/blocks/edit/editable-blocks");

  return { default: module.EditableBlocks };
});

export function BlockPage({ kind }: { readonly kind: SitePageKind }): JSX.Element {
  const { siteDocument, edit } = useSite();
  const blocks = siteDocumentPage(siteDocument, kind)?.blocks ?? [];

  if (edit) {
    return (
      <Suspense fallback={null}>
        <EditableBlocks kind={kind} blocks={blocks} editing={edit.editing} />
      </Suspense>
    );
  }

  return (
    <>
      {blocks.map((block) => (
        <BlockSlot key={block.id} block={block} kind={kind} />
      ))}
    </>
  );
}
