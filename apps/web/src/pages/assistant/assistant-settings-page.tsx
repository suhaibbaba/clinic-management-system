import type { JSX } from "react";
import { PageHeader, TabPanel, Tabs, useTabParam } from "@clinic/ui";
import { ActionsPanel } from "@web/components/assistant/settings/actions-panel";
import { AutomationRulesPanel } from "@web/components/assistant/settings/automation-rules-panel";
import { OutboundLogPanel } from "@web/components/assistant/settings/outbound-log-panel";
import { ProviderKeysPanel } from "@web/components/assistant/settings/provider-keys-panel";
import { ASSISTANT_SETTINGS_TABS } from "@web/constants/assistant";
type Tab = (typeof ASSISTANT_SETTINGS_TABS)[number];

export function AssistantSettingsPage(): JSX.Element {
  const [tab, setTab] = useTabParam<Tab>("tab", ASSISTANT_SETTINGS_TABS, "rules", [
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
        tabs={ASSISTANT_SETTINGS_TABS.map((id) => ({ id, label: `assistantSettings.tabs.${id}` }))}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id={tab}>
        {tab === "rules" && <AutomationRulesPanel />}
        {tab === "actions" && <ActionsPanel />}
        {tab === "outbound" && <OutboundLogPanel />}
        {tab === "keys" && <ProviderKeysPanel />}
      </TabPanel>
    </div>
  );
}
