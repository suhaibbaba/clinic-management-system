import { createContext } from "react";
import type { PortalAccountState } from "@web/site/hooks/use-portal-account";

export const PortalContext = createContext<PortalAccountState | null>(null);
