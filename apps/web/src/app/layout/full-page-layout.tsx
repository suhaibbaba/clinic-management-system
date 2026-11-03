import type { JSX } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageErrorBoundary } from "@web/shared/components/page-error-boundary";
import { useTranslationBundle } from "@web/modules/translations/queries";
import { useApplyTranslationOverrides } from "@web/modules/translations/hooks/use-translation-overrides";

export function FullPageLayout(): JSX.Element {
  const overrides = useTranslationBundle(true);
  useApplyTranslationOverrides(overrides.data);

  const { pathname } = useLocation();

  return (
    <main
      id="main"
      tabIndex={-1}
      data-testid="full-page-main"
      className="flex h-dvh min-w-0 flex-col bg-canvas outline-none"
    >
      <PageErrorBoundary key={pathname}>
        <Outlet />
      </PageErrorBoundary>
    </main>
  );
}
