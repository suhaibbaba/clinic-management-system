import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { ToastProvider } from '@web/components/ui';
import { SessionProvider } from '@web/features/auth/session';
import '@web/i18n';

/** No retries and no caching between tests, so each one starts clean. */
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
  /** Wrap in SessionProvider — the default; disable to test it in isolation. */
  withSession?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', withSession = true }: RenderOptions = {},
): RenderResult {
  const client = createTestQueryClient();

  const tree = (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          {withSession ? <SessionProvider>{ui}</SessionProvider> : ui}
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );

  return render(tree);
}

export interface MockResponse {
  status?: number;
  body?: unknown;
}

export type RouteHandler = (request: { body: unknown; url: string }) => MockResponse;

/**
 * Scripts `fetch` by "METHOD /path".
 *
 * The real api client runs on top of this, so the token handling and the
 * refresh-once-on-401 behaviour under test are the shipped ones, not a stub.
 */
export function mockApi(handlers: Record<string, RouteHandler | MockResponse>): {
  calls: { method: string; url: string; body: unknown }[];
} {
  const calls: { method: string; url: string; body: unknown }[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.replace(/^\/api/, '').split('?')[0] ?? '';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    calls.push({ method, url, body });

    const handler = handlers[`${method} ${path}`];

    if (!handler) {
      return new Response(JSON.stringify({ message: `Unhandled ${method} ${path}` }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const result = typeof handler === 'function' ? handler({ body, url }) : handler;
    const status = result.status ?? 200;

    return new Response(status === 204 ? null : JSON.stringify(result.body ?? {}), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);

  return { calls };
}
