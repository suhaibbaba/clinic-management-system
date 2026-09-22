import type { JSX } from "react";
import { PageHeader, TabPanel, Tabs, useTabParam } from "@clinic/ui";
import { AutomationRulesPanel } from "@web/features/assistant/settings/automation-rules-panel";
import { OutboundLogPanel } from "@web/features/assistant/settings/outbound-log-panel";
import { ProviderKeysPanel } from "@web/features/assistant/settings/provider-keys-panel";

const TABS = ["rules", "outbound", "keys"] as const;
type Tab = (typeof TABS)[number];

export function AssistantSettingsPage(): JSX.Element {
  // The log's own filters and page belong to the log; they are dropped on the way to another tab.
  const [tab, setTab] = useTabParam<Tab>("tab", TABS, "rules", [
    "trigger",
    "outcome",
    "page",
    "perPage",
  ]);

  return (
    <div data-testid="assistant-settings-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="assistant-settings-header"
        title="assistantSettings.title"
        subtitle="assistantSettings.subtitle"
      />

      <Tabs
        data-testid="assistant-settings-tabs"
        label="assistantSettings.title"
        tabs={TABS.map((id) => ({ id, label: `assistantSettings.tabs.${id}` }))}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id={tab}>
        {tab === "rules" && <AutomationRulesPanel />}
        {tab === "outbound" && <OutboundLogPanel />}
        {tab === "keys" && <ProviderKeysPanel />}
      </TabPanel>
    </div>
  );
}
