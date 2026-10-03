import { Suspense, type JSX } from "react";
import { lazyPage } from "@web/shared/lib/lazy-page";
import { TabPanel, useTabParam, type TabDefinition } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { SectionViews } from "@web/shared/components/layout/section-views";
import { SETTINGS_INNER_PARAMS, SETTINGS_VIEWS } from "@web/modules/settings/constants";
import { SETTINGS_VIEW_CAPABILITIES } from "@web/shared/lib/navigation";
import { useSession } from "@web/shared/providers/session";

const TranslationsPage = lazyPage(async () => ({
  default: (await import("@web/modules/translations/pages/translations-page")).TranslationsPage,
}));
const AssistantSettingsPage = lazyPage(async () => ({
  default: (await import("@web/modules/assistant/pages/assistant-settings-page"))
    .AssistantSettingsPage,
}));
const PermissionsPage = lazyPage(async () => ({
  default: (await import("@web/modules/permissions/pages/permissions-page")).PermissionsPage,
}));
const AuditPage = lazyPage(async () => ({
  default: (await import("@web/modules/audit/pages/audit-page")).AuditPage,
}));
export type SettingsView = (typeof SETTINGS_VIEWS)[number];

const VIEWS: readonly TabDefinition<SettingsView>[] = [
  { id: "translations", label: "nav.translations" },
  { id: "assistant", label: "nav.assistant" },
  { id: "permissions", label: "nav.permissions" },
  { id: "audit", label: "nav.audit" },
];

export function SettingsSection(): JSX.Element {
  const { can } = useSession();
  const views = VIEWS.filter((view) => can(SETTINGS_VIEW_CAPABILITIES[view.id]));
  const ids = SETTINGS_VIEWS.filter((id) => can(SETTINGS_VIEW_CAPABILITIES[id]));
  const [active, setActive] = useTabParam<SettingsView>(
    "view",
    ids,
    ids[0] ?? "translations",
    SETTINGS_INNER_PARAMS,
  );

  return (
    <div data-testid="settings-section" className="flex flex-col gap-5">
      <SectionViews
        data-testid="settings-section-views"
        views={views}
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
