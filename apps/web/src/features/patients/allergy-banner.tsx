import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { USER_ROLE } from '@clinic/shared';

import { Icon } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { useAllergyFlags } from '@web/features/patients/queries';
import { cn } from '@web/lib/cn';
import { formatList } from '@web/lib/format';

// Renders as soon as its own query resolves, so nobody starts work without seeing it. It reads the
// narrow allergy endpoint, and a receptionist does not ask at all.
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
      <span>{formatList(data.allergies)}</span>
    </span>
  );
}
