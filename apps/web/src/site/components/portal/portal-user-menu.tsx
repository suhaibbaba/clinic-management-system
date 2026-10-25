import type { PortalAccount } from "@clinic/shared";
import { useCallback, useRef, useState, type JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLink } from "@web/site/components/site-link";
import { SITE_PARAM } from "@web/site/constants";
import { useDismiss } from "@web/site/hooks/use-dismiss";
import { useSite } from "@web/site/hooks/use-site";
import { chosenPatient } from "@web/site/lib/portal";
import { SITE_PATH } from "@web/site/route";

export function PortalUserMenu({
  account,
  onSignOut,
}: {
  readonly account: PortalAccount;
  readonly onSignOut: () => void;
}): JSX.Element {
  const { t, params, page } = useSite();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const patientId = chosenPatient(account, params.get(SITE_PARAM.PATIENT));
  const patient = account.patients.find((entry) => entry.id === patientId);
  const initial = patient?.firstName.charAt(0) ?? "";

  useDismiss(open, close, root, trigger);

  return (
    <div ref={root} data-testid="site-user-menu" className="relative">
      <button
        ref={trigger}
        type="button"
        data-part="trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="site-user-menu-list"
        aria-label={t("portal.accountMenu")}
        onClick={() => setOpen((value) => !value)}
        className="pill-text inline-flex min-h-(--control-h) cursor-pointer items-center gap-2 rounded-pill border border-line bg-surface ps-1 pe-2.5 text-label font-medium text-primary-900 hover:border-primary-300 aria-expanded:border-primary-300"
      >
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-pill bg-primary-100 font-bold text-primary-700"
        >
          {initial}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">{patient?.firstName}</span>
        <SiteIcon name="chevron-down" className="size-4 text-ink-muted" />
      </button>

      {open && (
        <div
          id="site-user-menu-list"
          role="menu"
          aria-label={t("portal.accountMenu")}
          data-part="menu"
          className="absolute end-0 top-full z-40 mt-2 flex w-64 flex-col rounded-panel border border-line bg-surface p-1.5 shadow-float"
        >
          {patient && (
            <div data-part="identity" className="flex items-center gap-3 px-2.5 py-3">
              <span
                aria-hidden
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-100 text-heading font-bold text-primary-700"
              >
                {initial}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-value font-bold text-primary-900">
                  {patient.fullName}
                </span>
                <span className="text-meta text-ink-muted">
                  {t("portal.fileNumber", { number: patient.fileNumber })}
                </span>
              </span>
            </div>
          )}
          <SiteLink
            to={SITE_PATH.ACCOUNT}
            role="menuitem"
            data-part="profile"
            {...(page.kind === "account" && { "aria-current": "page" as const })}
            onClick={close}
            className="flex min-h-(--control-h) items-center gap-2.5 rounded-control px-2.5 text-value text-ink hover:bg-primary-50"
          >
            <SiteIcon name="user" className="text-primary-600" />
            {t("portal.myProfile")}
          </SiteLink>
          <div role="separator" className="mx-1 my-1.5 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            data-part="sign-out"
            onClick={() => {
              close();
              onSignOut();
            }}
            className="flex min-h-(--control-h) w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-start text-value font-medium text-danger-600 hover:bg-danger-50"
          >
            <SiteIcon name="log-out" className="page-rtl:-scale-x-100" />
            {t("portal.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
