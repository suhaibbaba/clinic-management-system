import type { Clinic } from '@clinic/shared';
import type { JSX } from 'react';

import { Logo } from '@web/components/brand/logo';
import { formatDate } from '@web/lib/format';

/**
 * The letterhead at the top of every printed sheet: the mark, the clinic's own
 * name and contact details from settings, and the date it was issued.
 *
 * Shared rather than repeated per document, so a treatment plan and a
 * prescription cannot drift into looking like they came from two clinics. The
 * clinic is passed in rather than fetched here, so a printable sheet stays a
 * pure function of what its parent already loaded.
 */
export function PrintLetterhead({ clinic }: { clinic: Clinic | undefined }): JSX.Element {
  return (
    <header className="print-letterhead">
      <div className="print-brand">
        <Logo size="md" className="print-logo" />
        <div>
          <h1 className="print-clinic-name">{clinic?.name ?? ''}</h1>
          <p className="print-clinic-contact">
            {[clinic?.phone, clinic?.address].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <p className="print-issued" dir="ltr">
        {formatDate(new Date().toISOString())}
      </p>
    </header>
  );
}
