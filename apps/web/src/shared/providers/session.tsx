import type {
  AuthenticatedUserProfile,
  LoginInput,
  LoginResponse,
  VerifyLoginCodeInput,
} from "@clinic/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { authApi } from "@web/shared/api/auth";
import { restoreSession } from "@web/shared/lib/api-client";
import { authTokens } from "@web/shared/lib/auth-tokens";
import { signInWithPasskey } from "@web/shared/lib/passkeys";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export type Can = (capability: string) => boolean;

interface SessionValue {
  readonly status: SessionStatus;
  readonly user: AuthenticatedUserProfile | null;
  readonly login: (input: LoginInput) => Promise<void>;
  readonly loginWithCode: (input: VerifyLoginCodeInput) => Promise<void>;
  readonly loginWithPasskey: (rememberMe: boolean) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly refreshProfile: () => Promise<void>;
  readonly can: Can;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }

  return context;
}

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthenticatedUserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const restored = await restoreSession();

      if (!restored) {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
        return;
      }

      try {
        const profile = await authApi.me();
        if (!cancelled) {
          setUser(profile);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      authTokens.onSessionEnded(() => {
        setUser(null);
        setStatus("unauthenticated");
      }),
    [],
  );

  const begin = useCallback((response: LoginResponse) => {
    authTokens.set(response.accessToken);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (input: LoginInput) => begin(await authApi.login(input)),
    [begin],
  );

  const loginWithCode = useCallback(
    async (input: VerifyLoginCodeInput) => begin(await authApi.verifyLoginCode(input)),
    [begin],
  );

  const loginWithPasskey = useCallback(
    async (rememberMe: boolean) => begin(await signInWithPasskey(rememberMe)),
    [begin],
  );

  const refreshProfile = useCallback(async () => {
    try {
      setUser(await authApi.me());
    } catch {}
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      authTokens.clear();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const granted = useMemo(() => new Set(user?.capabilities ?? []), [user]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      login,
      loginWithCode,
      loginWithPasskey,
      logout,
      refreshProfile,
      can: (capability: string) => granted.has(capability),
    }),
    [status, user, login, loginWithCode, loginWithPasskey, logout, refreshProfile, granted],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
