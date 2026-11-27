import type { ChartGlyph } from "@clinic/shared";
import type { ComponentType, JSX } from "react";
import { ToothRibbon } from "@web/site/components/footer-curves";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSiteGlyph } from "@web/site/hooks/use-site-glyph";

const MARKS: Partial<Record<ChartGlyph | "stethoscope", ComponentType<{ className?: string }>>> = {
  tooth: ToothRibbon,
};

export function FooterMark({ className }: { readonly className: string }): JSX.Element {
  const glyph = useSiteGlyph();
  const Mark = MARKS[glyph];

  return Mark ? (
    <Mark className={className} />
  ) : (
    <SiteIcon name={glyph} className={`${className} text-primary-100`} />
  );
}
