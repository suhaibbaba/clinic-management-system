import type { PortalAccount } from "@clinic/shared";
import { useCallback, useEffect, useState } from "react";
import { isSignedOut, portalApi } from "@web/site/api";

export type PortalState =
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | { readonly status: "ready"; readonly account: PortalAccount }
  | { readonly status: "failed"; readonly error: unknown };

export interface PortalAccountState {
  readonly state: PortalState;
  readonly signedIn: (account: PortalAccount) => void;
  readonly signOut: () => Promise<void>;
  readonly expired: () => void;
  readonly retry: () => void;
}

export function usePortalAccount(enabled: boolean): PortalAccountState {
  const [state, setState] = useState<PortalState>({
    status: enabled ? "loading" : "signedOut",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let ignore = false;

    setState({ status: "loading" });
    portalApi
      .account()
      .then((account) => {
        if (!ignore) {
          setState({ status: "ready", account });
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setState(isSignedOut(error) ? { status: "signedOut" } : { status: "failed", error });
        }
      });

    return () => {
      ignore = true;
    };
  }, [enabled, attempt]);

  const signedIn = useCallback((account: PortalAccount) => {
    setState({ status: "ready", account });
  }, []);

  const expired = useCallback(() => setState({ status: "signedOut" }), []);

  const signOut = useCallback(async () => {
    try {
      await portalApi.endSession();
    } catch {}

    setState({ status: "signedOut" });
  }, []);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { state, signedIn, signOut, expired, retry };
}
