import type { AuthenticatedUserProfile, LoginInput, UserRole } from '@clinic/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';

import { authApi } from '@web/features/auth/api';
import { restoreSession } from '@web/lib/api-client';
import { authTokens } from '@web/lib/auth-tokens';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionValue {
  readonly status: SessionStatus;
  readonly user: AuthenticatedUserProfile | null;
  readonly login: (input: LoginInput) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly hasRole: (...roles: UserRole[]) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }

  return context;
}

/**
 * Holds the signed-in user.
 *
 * On a cold load there is no access token in memory — it is deliberately never
 * persisted — so the provider first tries a silent refresh against the httpOnly
 * cookie. That is what keeps a page reload signed in without exposing the
 * refresh token to JavaScript.
 */
export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const restored = await restoreSession();

      if (!restored) {
        if (!cancelled) {
          setStatus('unauthenticated');
        }
        return;
      }

      try {
        const profile = await authApi.me();
        if (!cancelled) {
          setUser(profile);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // A refresh that could not restore the session ends it everywhere at once.
  useEffect(
    () =>
      authTokens.onSessionEnded(() => {
        setUser(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const login = useCallback(async (input: LoginInput) => {
    const response = await authApi.login(input);
    authTokens.set(response.accessToken);
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      authTokens.clear();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      login,
      logout,
      hasRole: (...roles: UserRole[]) => (user ? roles.includes(user.role) : false),
    }),
    [status, user, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
