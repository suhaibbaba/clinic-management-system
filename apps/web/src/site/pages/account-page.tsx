import type { JSX } from "react";
import { Alert, Button, Skeleton, cx } from "@web/booking/ui";
import { siteFailureKey } from "@web/site/api";
import { PortalRecordView } from "@web/site/components/portal/portal-record-view";
import { PortalSignIn } from "@web/site/components/portal/portal-sign-in";
import { SectionHeading } from "@web/site/components/section-heading";
import { usePortal } from "@web/site/hooks/use-portal";
import { useSite } from "@web/site/hooks/use-site";

export function AccountPage(): JSX.Element {
  const { t } = useSite();
  const { state, signedIn, expired, retry } = usePortal();
  const ready = state.status === "ready";

  return (
    <section
      data-testid="site-account"
      {...(!ready && { "aria-labelledby": "account-title" })}
      className={cx(ready ? "bg-canvas" : "site-wash")}
    >
      <div className={cx("mx-auto flex max-w-6xl flex-col gap-8 px-4", ready ? "py-8" : "py-14")}>
        {!ready && (
          <SectionHeading
            id="account"
            align="center"
            level={1}
            title={t("portal.title")}
            subtitle={t("portal.subtitle")}
          />
        )}
        {state.status === "loading" ? (
          <Skeleton className="mx-auto h-72 w-full max-w-(--form-max) rounded-card" />
        ) : state.status === "failed" ? (
          <div className="mx-auto flex flex-col items-center gap-3">
            <Alert>{t(siteFailureKey(state.error))}</Alert>
            <Button variant="secondary" onClick={retry}>
              {t("common.retry")}
            </Button>
          </div>
        ) : state.status === "ready" ? (
          <PortalRecordView account={state.account} onExpired={expired} />
        ) : (
          <PortalSignIn onSignedIn={signedIn} />
        )}
      </div>
    </section>
  );
}
