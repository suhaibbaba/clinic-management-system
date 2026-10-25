import type {
  CreateContactMessageInput,
  PortalAccount,
  PortalCodeReceipt,
  PortalFileLink,
  PortalRecord,
  PublicSite,
} from "@clinic/shared";

const BASE = "/api/public/site";

const PORTAL_BASE = "/api/public/portal";

export type SiteFailure =
  "network" | "notFound" | "throttled" | "closed" | "unauthorized" | "server" | "generic";

export class SiteError extends Error {
  constructor(readonly failure: SiteFailure) {
    super(`Site request failed: ${failure}`);
    this.name = "SiteError";
  }
}

const failureFor = (status: number): SiteFailure =>
  status === 401
    ? "unauthorized"
    : status === 404
      ? "notFound"
      : status === 429
        ? "throttled"
        : status === 403
          ? "closed"
          : status >= 500
            ? "server"
            : "generic";

async function request<TResult>(
  url: string,
  body?: unknown,
  method: "GET" | "POST" | "DELETE" = body === undefined ? "GET" : "POST",
): Promise<TResult> {
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
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

  return response.status === 204 ? (undefined as TResult) : ((await response.json()) as TResult);
}

const encode = encodeURIComponent;

export const siteApi = {
  bySlug: (slug: string): Promise<PublicSite> => request(`${BASE}/${encode(slug)}`),

  byHost: (): Promise<PublicSite> => request(BASE),

  sendMessage: (slug: string, body: CreateContactMessageInput): Promise<{ received: true }> =>
    request(`${BASE}/${encode(slug)}/messages`, body),
};

export const portalApi = {
  requestCode: (slug: string, phone: string): Promise<PortalCodeReceipt> =>
    request(`${PORTAL_BASE}/${encode(slug)}/code`, { phone }),

  startSession: (slug: string, phone: string, code: string): Promise<PortalAccount> =>
    request(`${PORTAL_BASE}/${encode(slug)}/session`, { phone, code }),

  account: (): Promise<PortalAccount> => request(`${PORTAL_BASE}/account`),

  record: (patientId: string): Promise<PortalRecord> =>
    request(`${PORTAL_BASE}/patients/${encode(patientId)}`),

  fileLink: (patientId: string, attachmentId: string): Promise<PortalFileLink> =>
    request(
      `${PORTAL_BASE}/patients/${encode(patientId)}/attachments/${encode(attachmentId)}/link`,
    ),

  endSession: (): Promise<void> => request(`${PORTAL_BASE}/session`, undefined, "DELETE"),
};

export function siteFailureKey(error: unknown): string {
  return `errors.${error instanceof SiteError ? error.failure : "generic"}`;
}

export const isSignedOut = (error: unknown): boolean =>
  error instanceof SiteError && error.failure === "unauthorized";
