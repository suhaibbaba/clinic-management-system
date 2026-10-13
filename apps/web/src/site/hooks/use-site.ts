import { useContext } from "react";
import { SiteContext, type SiteContextValue } from "@web/site/lib/site-context";

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);

  if (!value) {
    throw new Error("useSite must be used inside the site page");
  }

  return value;
}
