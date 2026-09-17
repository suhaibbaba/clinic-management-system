import { useEffect, useState } from "react";

const KEY = "clinic.branding.";

export function useClinicLogo(
  slug: string | undefined,
  live: string | null | undefined,
): string | null {
  const [cached, setCached] = useState<string | null>(null);

  useEffect(() => {
    setCached(slug === undefined ? null : read(slug));
  }, [slug]);

  useEffect(() => {
    if (slug !== undefined && live !== undefined) {
      write(slug, live);
    }
  }, [slug, live]);

  return live === undefined ? cached : live;
}

function read(slug: string): string | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY + slug) ?? "null");
    const url = (parsed as { logoUrl?: unknown } | null)?.logoUrl;

    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}

function write(slug: string, logoUrl: string | null): void {
  try {
    localStorage.setItem(KEY + slug, JSON.stringify({ logoUrl }));
  } catch {
    // A private window refuses storage; nothing here is worth failing a page over.
  }
}
