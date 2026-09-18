import { PageTitleProvider } from "@clinic/ui/lib/page-title";
import { useEffect, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { routeTitle } from "@web/app/navigation";
import { usePersonName } from "@clinic/ui/components/person-name";
import { useSession } from "@web/features/auth/session";
import { useClinicBranding } from "@web/features/clinic/queries";

/** `{page} — {clinic}`, and whichever half exists on its own. */
export function documentTitle(page: string | undefined, clinic: string | undefined): string {
  return [page, clinic].filter((part) => part !== undefined && part.trim() !== "").join(" — ");
}

export function DocumentTitleProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { status, user } = useSession();
  const resolve = usePersonName();
  const [page, setPage] = useState<string | null>(null);

  const branding = useClinicBranding(status === "unauthenticated");
  const clinicName = resolve(user ? user.clinic.name : branding.data?.name);
  const route = routeTitle(pathname);

  useEffect(() => {
    document.title = documentTitle(
      page ?? (route === undefined ? undefined : t(route)),
      clinicName,
    );
  }, [page, route, clinicName, t]);

  return <PageTitleProvider value={setPage}>{children}</PageTitleProvider>;
}
