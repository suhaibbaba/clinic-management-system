import type { JSX } from "react";
import { SiteImageField } from "@web/modules/website/components/site-image-field";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { joinPath, valueAt, withValueAt } from "@web/modules/website/lib/site-draft";

export function DraftImage({
  path,
  label,
  minWidth,
}: {
  readonly path: string;
  readonly label: string;
  readonly minWidth: number;
}): JSX.Element {
  const { draft, update, images, remember, scope } = useEditor();
  const full = joinPath(scope, path);
  const key = valueAt(draft, full) as string | null | undefined;

  return (
    <SiteImageField
      id={full.replaceAll(".", "-")}
      label={label}
      minWidth={minWidth}
      hasImage={typeof key === "string"}
      url={key ? images[key] : undefined}
      onUpload={(next, url) => {
        remember(next, url);
        update((current) => withValueAt(current, full, next));
      }}
      onRemove={() => update((current) => withValueAt(current, full, null))}
    />
  );
}
