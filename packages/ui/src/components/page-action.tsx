import type { JSX, ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePageActionSlot } from "@ui/lib/page-action-slot";

/** The top bar's "new …" button for a screen with no `PageHeader` to carry it. */
export function PageAction({ children }: { readonly children: ReactNode }): JSX.Element {
  const slot = usePageActionSlot();

  // Nothing to portal into — a test, the booking app — so it stays where it was written.
  return slot === null ? <>{children}</> : createPortal(children, slot);
}
