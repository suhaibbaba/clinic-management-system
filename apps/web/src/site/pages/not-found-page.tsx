import type { JSX } from "react";
import { PillLink } from "@web/site/components/pill-link";
import { useSite } from "@web/site/hooks/use-site";

export function NotFoundPage(): JSX.Element {
  const { t } = useSite();

  return (
    <div
      data-testid="site-not-found"
      className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center"
    >
      <h1 className="text-headline font-bold text-primary-900">{t("notFound.title")}</h1>
      <PillLink to="/">{t("notFound.home")}</PillLink>
    </div>
  );
}
