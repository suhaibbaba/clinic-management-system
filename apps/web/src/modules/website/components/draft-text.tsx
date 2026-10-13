import type { SiteText } from "@clinic/shared";
import type { JSX } from "react";
import { TextPair } from "@web/modules/website/components/text-pair";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { valueAt, withValueAt } from "@web/modules/website/lib/site-draft";

export function DraftText({
  path,
  label,
  multiline = false,
  required = false,
  hint,
  placeholder,
}: {
  readonly path: string;
  readonly label: string;
  readonly multiline?: boolean;
  readonly required?: boolean;
  readonly hint?: string;
  readonly placeholder?: string;
}): JSX.Element {
  const { draft, update, errors, leave } = useEditor();
  const value = (valueAt(draft, path) as SiteText | undefined) ?? { ar: "", en: "" };

  return (
    <TextPair
      id={path.replaceAll(".", "-")}
      label={label}
      path={path}
      value={value}
      errors={errors}
      leave={leave}
      multiline={multiline}
      required={required}
      {...(hint !== undefined && { hint })}
      {...(placeholder !== undefined && { placeholder })}
      onChange={(next) => update((current) => withValueAt(current, path, next))}
    />
  );
}
