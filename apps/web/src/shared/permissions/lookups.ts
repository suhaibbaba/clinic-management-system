import type { Can } from "@web/shared/providers/session";

export const canAddLookupOption = (can: Can): boolean => can("lookups.create");
