import { Component, type ErrorInfo, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Icon } from "@clinic/ui";

interface State {
  readonly failed: boolean;
}

// Without it one failing component unmounts the whole tree, and the reader gets a white page with
// nothing to press.
/** Shows a reload prompt in place of whatever beneath it failed to render or load. */
export class PageErrorBoundary extends Component<{ readonly children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Page failed to render", error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? <PageFailed /> : this.props.children;
  }
}

function PageFailed(): JSX.Element {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="alert"
      data-testid="page-failed"
      title="errors.pageFailed.title"
      hint="errors.pageFailed.hint"
      action={
        <Button
          icon={<Icon name="reset" />}
          data-testid="page-failed-reload"
          onClick={() => window.location.reload()}
        >
          {t("common.reload")}
        </Button>
      }
    />
  );
}
