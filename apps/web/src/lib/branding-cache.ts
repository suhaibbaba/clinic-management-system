const PREFIX = 'clinic.branding.';

export interface CachedBranding {
  readonly logoUrl: string | null;
}

/**
 * The last logo URL this browser saw, so a repeat visit paints the mark from cache before any
 * response arrives. Scoped per clinic; the network answer replaces it.
 */
export function readBranding(scope: string): CachedBranding | null {
  try {
    const raw = localStorage.getItem(PREFIX + scope);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const { logoUrl } = parsed as { logoUrl?: unknown };

    return typeof logoUrl === 'string' || logoUrl === null ? { logoUrl: logoUrl ?? null } : null;
  } catch {
    // A private window, or a stale shape from an older build.
    return null;
  }
}

export function writeBranding(scope: string, branding: CachedBranding): void {
  try {
    localStorage.setItem(PREFIX + scope, JSON.stringify(branding));
  } catch {
    // Storage is a convenience here; the URL is in the response either way.
  }
}
