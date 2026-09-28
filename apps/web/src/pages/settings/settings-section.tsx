import { Suspense, type JSX } from "react";
import { lazyPage } from "@web/lib/lazy-page";
import { TabPanel, useTabParam, type TabDefinition } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { SectionViews } from "@web/components/layout/section-views";
import { SETTINGS_INNER_PARAMS, SETTINGS_VIEWS } from "@web/constants/settings";

const TranslationsPage = lazyPage(async () => ({
  default: (await import("@web/pages/translations/translations-page")).TranslationsPage,
}));
const AssistantSettingsPage = lazyPage(async () => ({
  default: (await import("@web/pages/assistant/assistant-settings-page")).AssistantSettingsPage,
}));
const PermissionsPage = lazyPage(async () => ({
  default: (await import("@web/pages/permissions/permissions-page")).PermissionsPage,
}));
const AuditPage = lazyPage(async () => ({
  default: (await import("@web/pages/audit/audit-page")).AuditPage,
}));
export type SettingsView = (typeof SETTINGS_VIEWS)[number];

const VIEWS: readonly TabDefinition<SettingsView>[] = [
  { id: "translations", label: "nav.translations" },
  { id: "assistant", label: "nav.assistant" },
  { id: "permissions", label: "nav.permissions" },
  { id: "audit", label: "nav.audit" },
];

export function SettingsSection(): JSX.Element {
  const [active, setActive] = useTabParam<SettingsView>(
    "view",
    SETTINGS_VIEWS,
    "translations",
    SETTINGS_INNER_PARAMS,
  );

  return (
    <div data-testid="settings-section" className="flex flex-col gap-5">
      <SectionViews
        data-testid="settings-section-views"
        views={VIEWS}
        value={active}
        onChange={setActive}
        label="nav.settingsPage"
      />

      <TabPanel id={active} data-testid="settings-section-panel">
        <Suspense
          fallback={<Skeleton aria-hidden="true" className="h-[520px] w-full rounded-card" />}
        >
          {active === "translations" && <TranslationsPage />}
          {active === "assistant" && <AssistantSettingsPage />}
          {active === "permissions" && <PermissionsPage />}
          {active === "audit" && <AuditPage />}
        </Suspense>
      </TabPanel>
    </div>
  );
}
