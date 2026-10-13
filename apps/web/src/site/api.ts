import type { CreateContactMessageInput, PublicSite } from "@clinic/shared";

const BASE = "/api/public/site";

export type SiteFailure = "network" | "notFound" | "throttled" | "closed" | "server" | "generic";

export class SiteError extends Error {
  constructor(readonly failure: SiteFailure) {
    super(`Site request failed: ${failure}`);
    this.name = "SiteError";
  }
}

const failureFor = (status: number): SiteFailure =>
  status === 404
    ? "notFound"
    : status === 429
      ? "throttled"
      : status === 403
        ? "closed"
        : status >= 500
          ? "server"
          : "generic";

async function request<TResult>(path: string, body?: unknown): Promise<TResult> {
  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined
          ? { accept: "application/json" }
          : { accept: "application/json", "content-type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new SiteError("network");
  }

  if (!response.ok) {
    throw new SiteError(failureFor(response.status));
  }

  return (await response.json()) as TResult;
}

const encode = encodeURIComponent;

export const siteApi = {
  bySlug: (slug: string): Promise<PublicSite> => request(`/${encode(slug)}`),

  byHost: (): Promise<PublicSite> => request(""),

  sendMessage: (slug: string, body: CreateContactMessageInput): Promise<{ received: true }> =>
    request(`/${encode(slug)}/messages`, body),
};

export function siteFailureKey(error: unknown): string {
  return `errors.${error instanceof SiteError ? error.failure : "generic"}`;
}
