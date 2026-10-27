import { Suspense, type JSX } from "react";
import { TabPanel, useTabParam, type TabDefinition } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { SectionViews } from "@web/shared/components/layout/section-views";
import { lazyPage } from "@web/shared/lib/lazy-page";
import { CATALOG_VIEW_CAPABILITIES, mayOpen } from "@web/shared/lib/navigation";
import { useSession } from "@web/shared/providers/session";
import { CATALOG_INNER_PARAMS, CATALOG_VIEWS } from "@web/modules/lookups/constants";

const PriceListPage = lazyPage(async () => ({
  default: (await import("@web/modules/patients/pages/price-list-page")).PriceListPage,
}));
const LookupsPage = lazyPage(async () => ({
  default: (await import("@web/modules/lookups/pages/lookups-page")).LookupsPage,
}));

type CatalogView = (typeof CATALOG_VIEWS)[number];

const VIEWS: readonly TabDefinition<CatalogView>[] = [
  { id: "prices", label: "nav.priceList" },
  { id: "lists", label: "nav.lists" },
];

export function CatalogSection(): JSX.Element {
  const { can } = useSession();
  const views = VIEWS.filter((view) => mayOpen(CATALOG_VIEW_CAPABILITIES[view.id], can));
  const ids = CATALOG_VIEWS.filter((id) => mayOpen(CATALOG_VIEW_CAPABILITIES[id], can));
  const [active, setActive] = useTabParam<CatalogView>(
    "view",
    ids,
    ids[0] ?? "prices",
    CATALOG_INNER_PARAMS,
  );

  return (
    <div data-testid="catalog-section" className="flex flex-col gap-5">
      {views.length > 1 && (
        <SectionViews
          data-testid="catalog-section-views"
          views={views}
          value={active}
          onChange={setActive}
          label="nav.catalog"
        />
      )}

      <TabPanel id={active} data-testid="catalog-section-panel">
        <Suspense
          fallback={<Skeleton aria-hidden="true" className="h-[520px] w-full rounded-card" />}
        >
          {active === "prices" && <PriceListPage />}
          {active === "lists" && <LookupsPage />}
        </Suspense>
      </TabPanel>
    </div>
  );
}
