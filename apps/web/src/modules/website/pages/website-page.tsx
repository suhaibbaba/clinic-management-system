import type { JSX } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { PageHeader, TabPanel, Tabs, useTabParam, type TabDefinition } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { canEditWebsite, seesContactMessages } from "@web/shared/permissions/website";
import { useSession } from "@web/shared/providers/session";
import { useOpenContactMessagesCount } from "@web/shared/queries/website";
import { WEBSITE_TAB_CONTENT, WEBSITE_TAB_MESSAGES } from "@web/modules/website/constants";
import { WebsiteContentCard } from "@web/modules/website/components/website-content-card";
import { editorAddress } from "@web/modules/website/lib/editor-page";
import { WebsiteMessages } from "@web/modules/website/pages/website-messages";
import { useWebsiteEditor } from "@web/modules/website/queries";

type WebsiteTab = typeof WEBSITE_TAB_CONTENT | typeof WEBSITE_TAB_MESSAGES;

export function WebsitePage(): JSX.Element {
  const { can } = useSession();
  const mayEdit = canEditWebsite(can);
  const mayRead = seesContactMessages(can);
  const open = useOpenContactMessagesCount(mayRead);
  const editor = useWebsiteEditor(mayEdit);
  const showSkeleton = useDelayedLoading(editor.isPending);
  const [params] = useSearchParams();

  const tabs: TabDefinition<WebsiteTab>[] = [
    ...(mayEdit ? [{ id: WEBSITE_TAB_CONTENT, label: "website.tabs.content" } as const] : []),
    ...(mayRead
      ? [{ id: WEBSITE_TAB_MESSAGES, label: "website.tabs.messages", count: open } as const]
      : []),
  ];
  const [active, setActive] = useTabParam<WebsiteTab>(
    "tab",
    tabs.map((tab) => tab.id),
    tabs[0]?.id ?? WEBSITE_TAB_MESSAGES,
    ["page", "perPage", "status"],
  );
  const legacyEditor = mayEdit && active === WEBSITE_TAB_CONTENT ? editorAddress(params) : null;

  if (legacyEditor !== null) {
    return <Navigate to={legacyEditor} replace />;
  }

  return (
    <div data-testid="website-page" className="flex flex-col gap-5">
      <PageHeader data-testid="website-header" title="website.title" subtitle="website.subtitle" />

      {tabs.length > 1 && (
        <Tabs
          data-testid="website-tabs"
          tabs={tabs}
          value={active}
          onChange={setActive}
          label="website.tabs.label"
        />
      )}

      <TabPanel id={active} data-testid="website-panel">
        {active === WEBSITE_TAB_CONTENT &&
          (editor.data ? (
            <WebsiteContentCard editor={editor.data} />
          ) : showSkeleton ? (
            <Skeleton aria-hidden="true" className="h-48 w-full max-w-(--form-max) rounded-card" />
          ) : null)}
        {active === WEBSITE_TAB_MESSAGES && <WebsiteMessages />}
      </TabPanel>
    </div>
  );
}
