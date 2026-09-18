import { useEffect, useState } from "react";
import { readBranding, writeBranding } from "@web/lib/branding-cache";

export function useClinicLogo(
  scope: string | undefined,
  live: string | null | undefined,
): string | null {
  const [cached, setCached] = useState<string | null>(null);

  useEffect(() => {
    setCached(scope === undefined ? null : (readBranding(scope)?.logoUrl ?? null));
  }, [scope]);

  useEffect(() => {
    if (scope !== undefined && live !== undefined) {
      writeBranding(scope, { logoUrl: live });
    }
  }, [scope, live]);

  return live === undefined ? cached : live;
}
