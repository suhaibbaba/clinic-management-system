import type { JSX } from "react";
import { SiteImageField } from "@web/modules/website/components/site-image-field";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { valueAt, withValueAt } from "@web/modules/website/lib/site-draft";

export function DraftImage({
  path,
  label,
  minWidth,
}: {
  readonly path: string;
  readonly label: string;
  readonly minWidth: number;
}): JSX.Element {
  const { draft, update, images, remember } = useEditor();
  const key = valueAt(draft, path) as string | null | undefined;

  return (
    <SiteImageField
      id={path.replaceAll(".", "-")}
      label={label}
      minWidth={minWidth}
      hasImage={typeof key === "string"}
      url={key ? images[key] : undefined}
      onUpload={(next, url) => {
        remember(next, url);
        update((current) => withValueAt(current, path, next));
      }}
      onRemove={() => update((current) => withValueAt(current, path, null))}
    />
  );
}
