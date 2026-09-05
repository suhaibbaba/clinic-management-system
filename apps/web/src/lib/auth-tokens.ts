type Listener = () => void;

/**
 * The access token lives in memory only — never in localStorage or a cookie
 * readable by scripts. A page reload therefore starts unauthenticated and the
 * app silently refreshes from the httpOnly cookie the API set at login.
 */
let accessToken: string | null = null;

const sessionEndedListeners = new Set<Listener>();

export const authTokens = {
  get(): string | null {
    return accessToken;
  },

  set(token: string | null): void {
    accessToken = token;
  },

  clear(): void {
    accessToken = null;
  },

  /** Fires when a refresh could not restore the session. */
  onSessionEnded(listener: Listener): () => void {
    sessionEndedListeners.add(listener);
    return () => sessionEndedListeners.delete(listener);
  },

  notifySessionEnded(): void {
    accessToken = null;
    for (const listener of sessionEndedListeners) {
      listener();
    }
  },
};
