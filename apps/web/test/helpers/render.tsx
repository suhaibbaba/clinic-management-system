import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { LookupBundle } from "@clinic/shared";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { vi } from "vitest";
import { ToastProvider } from "@clinic/ui";
import { SessionProvider } from "@web/shared/providers/session";
import { lookupBundleKey } from "@web/shared/queries/lookups";
import { DocumentTitleProvider } from "@web/shared/providers/document-title";
import { makeLookupBundle } from "@test/helpers/fixtures";
import "@web/i18n";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderOptions {
  route?: string;
  withSession?: boolean;
  lookups?: LookupBundle;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", withSession = true, lookups = makeLookupBundle() }: RenderOptions = {},
): RenderResult {
  const client = createTestQueryClient();

  for (const includeInactive of [false, true]) {
    client.setQueryDefaults(lookupBundleKey(includeInactive), {
      initialData: lookups,
      staleTime: Infinity,
    });
  }

  const page = withSession ? (
    <SessionProvider>
      <DocumentTitleProvider>{ui}</DocumentTitleProvider>
    </SessionProvider>
  ) : (
    ui
  );
  const router = createMemoryRouter([{ path: "*", element: page }], {
    initialEntries: [route],
  });

  const tree = (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );

  return render(tree);
}

export interface MockResponse {
  status?: number;
  body?: unknown;
}

export type RouteHandler = (request: {
  body: unknown;
  url: string;
}) => MockResponse | Promise<MockResponse>;

export function mockApi(handlers: Record<string, RouteHandler | MockResponse>): {
  calls: { method: string; url: string; body: unknown }[];
} {
  const calls: { method: string; url: string; body: unknown }[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^\/api/, "").split("?")[0] ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    calls.push({ method, url, body });

    const handler = handlers[`${method} ${path}`];

    if (!handler) {
      return new Response(JSON.stringify({ message: `Unhandled ${method} ${path}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const result = await (typeof handler === "function" ? handler({ body, url }) : handler);
    const status = result.status ?? 200;

    return new Response(status === 204 ? null : JSON.stringify(result.body ?? {}), {
      status,
      headers: { "content-type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return { calls };
}
