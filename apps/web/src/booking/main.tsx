import { StrictMode, type JSX } from "react";
import { createRoot } from "react-dom/client";
import "@web/booking/booking.css";
import { BookingWizard } from "@web/booking/booking-wizard";
import { BOOKING_LANGUAGE, t } from "@web/booking/i18n";
import { FullPageMessage, PageShell } from "@web/booking/layout";
import { ManagePage } from "@web/booking/manage-page";
import { parseRoute } from "@web/booking/route";

function BookingApp(): JSX.Element {
  const route = parseRoute(window.location.pathname, window.location.search);

  switch (route.kind) {
    case "book":
      return <BookingWizard slug={route.slug} />;

    case "manage":
      return <ManagePage token={route.token} slug={route.slug} />;

    default:
      return (
        <PageShell clinicName={undefined}>
          <FullPageMessage title={t("errors.notFound")} />
        </PageShell>
      );
  }
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root is missing from booking.html");
}

document.documentElement.lang = BOOKING_LANGUAGE;
document.documentElement.dir = "rtl";

createRoot(container).render(
  <StrictMode>
    <BookingApp />
  </StrictMode>,
);
