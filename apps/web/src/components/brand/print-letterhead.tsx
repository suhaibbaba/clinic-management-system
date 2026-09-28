import type { Clinic } from "@clinic/shared";
import type { JSX } from "react";
import { Logo } from "@web/components/brand/logo";
import { formatDate } from "@web/lib/format";
import { PersonName } from "@clinic/ui/components/person-name";

export function PrintLetterhead({ clinic }: { clinic: Clinic | undefined }): JSX.Element {
  return (
    <header data-testid="print-letterhead" className="print-letterhead">
      <div className="print-brand">
        {clinic?.logoUrl && <Logo size="print" src={clinic.logoUrl} className="print-logo" />}
        <div>
          <h1 data-testid="print-clinic-name" className="print-clinic-name">
            <PersonName name={clinic?.name} fallback="" />
          </h1>
          <p data-testid="print-clinic-contact" className="print-clinic-contact">
            {clinic?.phone && (
              <span dir="ltr" className="inline-block w-fit whitespace-nowrap">
                {clinic.phone}
              </span>
            )}
            {clinic?.phone && clinic?.address && <span aria-hidden> · </span>}
            {clinic?.address}
          </p>
        </div>
      </div>

      <p data-testid="print-issued" className="print-issued" dir="ltr">
        {formatDate(new Date().toISOString())}
      </p>
    </header>
  );
}
