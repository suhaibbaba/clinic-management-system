import type { JSX } from "react";
import { FormField, Input } from "@clinic/ui";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { valueAt, withValueAt } from "@web/modules/website/lib/site-draft";

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
  const { draft, update, errors, leave } = useEditor();
  const id = path.replaceAll(".", "-");
  const value = (valueAt(draft, path) as string | undefined) ?? "";

  return (
    <div onBlur={leave(path)}>
      <FormField
        label={label}
        htmlFor={id}
        error={errors[path]}
        errorKey="website.fields.invalidLink"
        optional
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
          hasError={errors[path] !== undefined}
          onChange={(event) =>
            update((current) => withValueAt(current, path, event.target.value.trim()))
          }
        />
      </FormField>
    </div>
  );
}
