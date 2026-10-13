import type { SiteContent } from "@clinic/shared";
import { createContext, type FocusEvent } from "react";
import type { FieldErrors } from "@web/shared/lib/form-errors";

export interface EditorValue {
  readonly draft: SiteContent;
  readonly update: (change: (current: SiteContent) => SiteContent) => void;
  readonly images: Readonly<Record<string, string>>;
  readonly remember: (key: string, url: string) => void;
  readonly errors: FieldErrors;
  readonly leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
}

export const EditorContext = createContext<EditorValue | null>(null);
