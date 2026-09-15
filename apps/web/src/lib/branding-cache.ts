const PREFIX = 'clinic.branding.';

export interface CachedBranding {
  readonly logoUrl: string | null;
}

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
    return null;
  }
}

export function writeBranding(scope: string, branding: CachedBranding): void {
  try {
    localStorage.setItem(PREFIX + scope, JSON.stringify(branding));
  } catch {
    // A private window refuses storage; nothing here is worth failing a page over.
  }
}
