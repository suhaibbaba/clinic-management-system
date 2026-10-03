import { PageErrorBoundary } from "@web/shared/components/page-error-boundary";
import type { JSX } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from "@web/app/providers";
import { AppRoutes } from "@web/app/router";

const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <AppProviders>
        <PageErrorBoundary>
          <AppRoutes />
        </PageErrorBoundary>
      </AppProviders>
    ),
  },
]);

export function App(): JSX.Element {
  return <RouterProvider router={router} />;
}
