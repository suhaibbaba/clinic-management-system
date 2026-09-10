type Listener = () => void;

// In memory only, never in localStorage or a script-readable cookie: a reload starts
// unauthenticated and refreshes from the httpOnly cookie.
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
