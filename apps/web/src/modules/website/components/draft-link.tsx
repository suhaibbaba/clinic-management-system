import { siteDocumentSchema } from "@clinic/shared";
import type { JSX } from "react";
import { FormField, Input } from "@clinic/ui";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { joinPath, valueAt, withValueAt } from "@web/modules/website/lib/site-draft";
import { fieldNeed } from "@web/shared/lib/schema-fields";

export function DraftLink({
  path,
  label,
  hint,
  placeholder,
  maxLength = 300,
  adornment,
}: {
  readonly path: string;
  readonly label: string;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly adornment?: "globe";
}): JSX.Element {
  const { draft, update, errors, leave, scope } = useEditor();
  const full = joinPath(scope, path);
  const id = full.replaceAll(".", "-");
  const value = (valueAt(draft, full) as string | undefined) ?? "";

  return (
    <div onBlur={leave(full)}>
      <FormField
        label={label}
        htmlFor={id}
        error={errors[full]}
        errorKey="website.fields.invalidLink"
        {...fieldNeed(siteDocumentSchema, full)}
        {...(hint !== undefined && { hint })}
      >
        <Input
          id={id}
          data-testid={`draft-link-${id}`}
          dir="ltr"
          inputMode="url"
          maxLength={maxLength}
          value={value}
          {...(placeholder !== undefined && { placeholder })}
          {...(adornment === "globe" && { adornment: "globe" as const })}
          hasError={errors[full] !== undefined}
          onChange={(event) =>
            update((current) => withValueAt(current, full, event.target.value.trim()))
          }
        />
      </FormField>
    </div>
  );
}
