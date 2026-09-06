import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { USER_ROLE } from '@clinic/shared';

import { Icon } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { useAllergyFlags } from '@web/features/patients/queries';
import { cn } from '@web/lib/cn';

/**
 * Allergies, at the top of the patient file and before anything else.
 *
 * It renders the moment its own query resolves, independently of the patient
 * record and the chart, because the whole point is that nobody starts working
 * on this patient without having seen it.
 *
 * A chip, not a banner. It used to be a full-width red slab with the word
 * "Allergies" in bold, which is the visual weight of a system error rather
 * than of a fact about the patient — and on a file where the actual data is
 * "iodine", eight words of chrome carried one word of content. Sized to its
 * text and set in the red, it is still the first and reddest thing on the
 * page, and still announced assertively.
 *
 * The data comes from the narrow allergy-flags endpoint rather than the full
 * medical history: it is all this needs, and it is the one medical read a
 * technician is also allowed (ROLES.md).
 *
 * A receptionist gets no medical history at all, allergies included, so the
 * query is not made rather than made and refused — a 403 in the console on
 * every patient they open teaches everyone to ignore 403s.
 */
export function AllergyBanner({ patientId }: { patientId: string }): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const mayRead = user !== null && user.role !== USER_ROLE.RECEPTIONIST;
  const { data } = useAllergyFlags(patientId, mayRead);

  if (!data?.hasAllergies) {
    return null;
  }

  return (
    <span
      role="alert"
      className={cn(
        // `inline-flex`, so it is as wide as what it says and no wider.
        'inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5',
        'rounded-pill border border-danger-200 bg-danger-50 py-1 pe-3 ps-2.5',
        'text-label text-danger-700',
      )}
    >
      <Icon name="alert" className="size-4 shrink-0 text-danger-600" />
      <span className="font-medium">{t('patients.allergies')}:</span>
      <span>{data.allergies.join('، ')}</span>
    </span>
  );
}
