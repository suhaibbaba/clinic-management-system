import { useCallback, useState } from "react";
import { readRememberMe, writeRememberMe } from "@web/modules/auth/lib/remember-me";

export function useRememberMe(): readonly [boolean, (rememberMe: boolean) => void] {
  const [rememberMe, setRememberMe] = useState(readRememberMe);

  const change = useCallback((next: boolean) => {
    writeRememberMe(next);
    setRememberMe(next);
  }, []);

  return [rememberMe, change] as const;
}
