import { useEditor } from "@web/modules/website/hooks/use-editor";
import { joinPath, valueAt, withValueAt } from "@web/modules/website/lib/site-draft";

export interface Scoped<TValue> {
  readonly value: TValue;
  readonly path: (field: string) => string;
  readonly set: (field: string, next: unknown) => void;
}

export function useScoped<TValue>(): Scoped<TValue> {
  const { draft, update, scope } = useEditor();

  return {
    value: valueAt(draft, scope) as TValue,
    path: (field) => joinPath(scope, field),
    set: (field, next) => update((current) => withValueAt(current, joinPath(scope, field), next)),
  };
}
