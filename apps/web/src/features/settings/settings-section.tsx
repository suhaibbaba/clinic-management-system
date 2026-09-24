import { lazy, Suspense, type JSX } from "react";
import { TabPanel, useTabParam, type TabDefinition } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { SectionViews } from "@web/components/layout/section-views";

const TranslationsPage = lazy(async () => ({
  default: (await import("@web/features/translations/translations-page")).TranslationsPage,
}));
const AssistantSettingsPage = lazy(async () => ({
  default: (await import("@web/features/assistant/settings/assistant-settings-page"))
    .AssistantSettingsPage,
}));
const PermissionsPage = lazy(async () => ({
  default: (await import("@web/features/permissions/permissions-page")).PermissionsPage,
}));
const AuditPage = lazy(async () => ({
  default: (await import("@web/features/audit/audit-page")).AuditPage,
}));

export const SETTINGS_VIEWS = ["translations", "assistant", "permissions", "audit"] as const;
export type SettingsView = (typeof SETTINGS_VIEWS)[number];

const VIEWS: readonly TabDefinition<SettingsView>[] = [
  { id: "translations", label: "nav.translations" },
  { id: "assistant", label: "nav.assistant" },
  { id: "permissions", label: "nav.permissions" },
  { id: "audit", label: "nav.audit" },
];

// Every param one of the pages below keeps, so a switch lands on the next page clean.
const INNER_PARAMS = ["tab", "role", "section", "changed", "trigger", "outcome", "page", "perPage"];

export function SettingsSection(): JSX.Element {
  // `view`, not `tab`: the assistant's settings keep a `tab` of their own.
  const [active, setActive] = useTabParam<SettingsView>(
    "view",
    SETTINGS_VIEWS,
    "translations",
    INNER_PARAMS,
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
