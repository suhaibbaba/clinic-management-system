import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Icon } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { WebsiteEditor } from "@web/modules/website/pages/website-editor";
import { useWebsiteEditor } from "@web/modules/website/queries";

export function WebsiteEditorPage(): JSX.Element {
  const { t } = useTranslation();
  const editor = useWebsiteEditor();
  const showSkeleton = useDelayedLoading(editor.isPending);

  return (
    <div data-testid="website-editor-page" className="flex min-h-0 flex-1 flex-col">
      {editor.data ? (
        <WebsiteEditor editor={editor.data} />
      ) : editor.isError ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <EmptyState
            icon="alert"
            data-testid="website-editor-failed"
            titleAs="h1"
            title="errors.pageFailed.title"
            hint="errors.pageFailed.hint"
            action={
              <Button
                icon={<Icon name="reset" />}
                data-testid="website-editor-retry"
                onClick={() => void editor.refetch()}
              >
                {t("common.reload")}
              </Button>
            }
          />
        </div>
      ) : showSkeleton ? (
        <div aria-hidden="true" className="flex flex-1 flex-col">
          <Skeleton className="h-13 w-full rounded-none" />
          <Skeleton className="m-4 flex-1 rounded-card" />
        </div>
      ) : null}
    </div>
  );
}
