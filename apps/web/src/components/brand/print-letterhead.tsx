import type { Clinic } from '@clinic/shared';
import type { JSX } from 'react';

import { Logo } from '@web/components/brand/logo';
import { formatDate } from '@web/lib/format';
import { PersonName } from '@web/components/ui/person-name';

// Shared, so a treatment plan and a prescription cannot look like they came from two clinics. The
// clinic is passed in, keeping a printable sheet a pure function.
export function PrintLetterhead({ clinic }: { clinic: Clinic | undefined }): JSX.Element {
  return (
    <header className="print-letterhead">
      <div className="print-brand">
        <Logo size="print" className="print-logo" />
        <div>
          {/* In the reader's language: this sheet prints from the browser, unlike the API's PDFs,
              which use the clinic's document language. */}
          <h1 className="print-clinic-name">
            <PersonName name={clinic?.name} fallback="" />
          </h1>
          {/* Its own run, not half a joined string: joined with an Arabic address the leading `+` is
              neutral and bidi gave it to the Arabic, printing `963110000000+`. */}
          <p className="print-clinic-contact">
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

      <p className="print-issued" dir="ltr">
        {formatDate(new Date().toISOString())}
      </p>
    </header>
  );
}
