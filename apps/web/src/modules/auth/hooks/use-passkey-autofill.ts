import { useEffect, useRef } from "react";
import { browserSupportsWebAuthnAutofill, WebAuthnAbortService } from "@simplewebauthn/browser";
import { isPasskeyAborted } from "@web/shared/lib/passkeys";
import {
  PASSKEY_AUTOFILL_REFRESH_MS,
  PASSKEY_AUTOFILL_RETRY_MS,
} from "@web/modules/auth/constants";

export function usePasskeyAutofill(
  signIn: () => Promise<void>,
  onError: (error: unknown) => void,
  paused: boolean,
): void {
  const signInRef = useRef(signIn);
  const onErrorRef = useRef(onError);
  signInRef.current = signIn;
  onErrorRef.current = onError;

  useEffect(() => () => WebAuthnAbortService.cancelCeremony(), []);

  useEffect(() => {
    if (paused) {
      return;
    }

    let active = true;
    let refresh: number | undefined;

    const schedule = (delay: number): void => {
      window.clearTimeout(refresh);
      refresh = window.setTimeout(start, delay);
    };

    const start = (): void => {
      schedule(PASSKEY_AUTOFILL_REFRESH_MS);

      signInRef.current().catch((error: unknown) => {
        if (!active || isPasskeyAborted(error)) {
          return;
        }

        onErrorRef.current(error);
        schedule(PASSKEY_AUTOFILL_RETRY_MS);
      });
    };

    void browserSupportsWebAuthnAutofill().then((supported) => {
      if (supported && active) {
        start();
      }
    });

    return () => {
      active = false;
      window.clearTimeout(refresh);
    };
  }, [paused]);
}
