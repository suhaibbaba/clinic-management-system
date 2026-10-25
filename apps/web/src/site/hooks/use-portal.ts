import { useContext } from "react";
import type { PortalAccountState } from "@web/site/hooks/use-portal-account";
import { PortalContext } from "@web/site/lib/portal-context";

export function usePortal(): PortalAccountState {
  const value = useContext(PortalContext);

  if (!value) {
    throw new Error("usePortal must be used inside the site page");
  }

  return value;
}
