import type { SiteText } from "@clinic/shared";
import type { JSX } from "react";
import { TextPair } from "@web/modules/website/components/text-pair";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { blankText, joinPath, valueAt, withValueAt } from "@web/modules/website/lib/site-draft";

export function DraftText({
  path,
  label,
  labelValues,
  multiline = false,
  required = false,
  hint,
  placeholder,
}: {
  readonly path: string;
  readonly label: string;
  readonly labelValues?: Record<string, string | number>;
  readonly multiline?: boolean;
  readonly required?: boolean;
  readonly hint?: string;
  readonly placeholder?: string;
}): JSX.Element {
  const { draft, update, errors, leave, scope } = useEditor();
  const full = joinPath(scope, path);
  const value = (valueAt(draft, full) as SiteText | undefined) ?? blankText();

  return (
    <TextPair
      id={full.replaceAll(".", "-")}
      label={label}
      {...(labelValues !== undefined && { labelValues })}
      path={full}
      value={value}
      errors={errors}
      leave={leave}
      multiline={multiline}
      required={required}
      {...(hint !== undefined && { hint })}
      {...(placeholder !== undefined && { placeholder })}
      onChange={(next) => update((current) => withValueAt(current, full, next))}
    />
  );
}
