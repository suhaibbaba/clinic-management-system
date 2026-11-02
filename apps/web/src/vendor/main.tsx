import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import "@web/vendor/vendor.css";
import "@web/vendor/i18n";
import { Shell } from "@web/vendor/components/shell";
import { useLocation } from "@web/vendor/hooks/use-location";
import { parseVendorRoute, vendorPath } from "@web/vendor/lib/route";
import { VENDOR_PARAM } from "@web/vendor/constants";
import { ClinicPage } from "@web/vendor/pages/clinic-page";
import { ClinicsPage } from "@web/vendor/pages/clinics-page";
import { LoginPage } from "@web/vendor/pages/login-page";
import { ForgotPage } from "@web/vendor/pages/forgot-page";
import { ResetPage } from "@web/vendor/pages/reset-page";
import { PUBLIC_ROUTES } from "@web/vendor/constants";
import { localized, PRODUCT_NAME } from "@clinic/shared";
import { PlansPage } from "@web/vendor/pages/plans-page";
import { useVendorSession } from "@web/vendor/queries";

const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 15_000 } },
});

function VendorApp(): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const session = useVendorSession();
  const route = parseVendorRoute(location.pathname);
  const signedOut = session.isError;
  const { navigate } = location;

  useEffect(() => {
    document.title = `${localized(PRODUCT_NAME, i18n.language)} — ${t("vendor.tagline")}`;
  }, [t, i18n.language]);

  useEffect(() => {
    if (signedOut && !PUBLIC_ROUTES.has(route.kind)) {
      navigate(vendorPath({ kind: "login" }), { replace: true });
    } else if (session.isSuccess && PUBLIC_ROUTES.has(route.kind)) {
      navigate(vendorPath({ kind: "clinics" }), { replace: true });
    }
  }, [signedOut, session.isSuccess, route.kind, navigate]);

  if (route.kind === "login") {
    return <LoginPage navigate={navigate} />;
  }

  if (route.kind === "forgot") {
    return <ForgotPage navigate={navigate} />;
  }

  if (route.kind === "reset") {
    return <ResetPage token={location.params.get("token") ?? ""} navigate={navigate} />;
  }

  if (!session.isSuccess) {
    return null;
  }

  switch (route.kind) {
    case "clinics":
      return (
        <Shell
          section="clinics"
          navigate={navigate}
          search={location.params.get(VENDOR_PARAM.SEARCH) ?? ""}
          key={location.params.get(VENDOR_PARAM.SEARCH) ?? ""}
        >
          <ClinicsPage location={location} />
        </Shell>
      );
    case "clinic":
      return (
        <Shell section="clinics" navigate={navigate}>
          <ClinicPage id={route.id} location={location} />
        </Shell>
      );
    case "plans":
      return (
        <Shell section="plans" navigate={navigate}>
          <PlansPage location={location} />
        </Shell>
      );
    case "not-found":
      return (
        <Shell section="clinics" navigate={navigate}>
          <p className="text-ink-muted">{t("vendor.errors.notFound")}</p>
        </Shell>
      );
  }
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root is missing from vendor.html");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <VendorApp />
    </QueryClientProvider>
  </StrictMode>,
);
