import { StrictMode, type JSX } from "react";
import { createRoot } from "react-dom/client";
import "@web/site/site.css";
import { Button, Skeleton } from "@web/booking/ui";
import { siteFailureKey } from "@web/site/api";
import { useSiteData } from "@web/site/hooks/use-site-data";
import { translator } from "@web/site/i18n";
import { siteSource } from "@web/site/route";
import { SitePage } from "@web/site/site-page";

const { source, base } = siteSource(window.location.pathname);
const t = translator("ar");

function SiteApp(): JSX.Element {
  const { site, error, loading, reload } = useSiteData(source);

  if (site) {
    return <SitePage site={site} preview={source.kind === "preview"} base={base} />;
  }

  if (loading) {
    return (
      <div data-testid="site-loading" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="aspect-[16/7] w-full rounded-card" />
        {source.kind === "preview" && (
          <p className="text-center text-label text-ink-muted">{t("preview.waiting")}</p>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="site-error"
      className="mx-auto mt-20 flex max-w-md flex-col items-center gap-4 px-4 text-center"
    >
      <h1 className="text-title font-medium text-primary-900">{t(siteFailureKey(error))}</h1>
      <Button variant="secondary" data-testid="site-retry" onClick={reload}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root is missing from site.html");
}

createRoot(container).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>,
);
