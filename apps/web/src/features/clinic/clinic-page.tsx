import { USER_ROLE, type WeeklySchedule } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, PageHeader, useToast } from '@web/components/ui';
import { ScheduleEditor } from '@web/components/schedule-editor';
import { useSession } from '@web/features/auth/session';
import { useClinic, useUpdateClinic } from '@web/features/clinic/queries';
import { errorMessageKey } from '@web/lib/api-error';

/** Admin edits; every other role sees the same screen read-only (ROLES.md). */
export function ClinicPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { hasRole } = useSession();
  const canEdit = hasRole(USER_ROLE.ADMIN);

  const clinic = useClinic();
  const updateClinic = useUpdateClinic();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('');
  const [workingHours, setWorkingHours] = useState<WeeklySchedule>([]);

  useEffect(() => {
    const data = clinic.data;

    if (!data) {
      return;
    }

    setName(data.name);
    setPhone(data.phone ?? '');
    setEmail(data.email ?? '');
    setAddress(data.address ?? '');
    setCurrency(data.currency);
    setWorkingHours(data.workingHours);
  }, [clinic.data]);

  const save = async (): Promise<void> => {
    try {
      await updateClinic.mutateAsync({
        name,
        phone: phone === '' ? null : phone,
        email: email === '' ? null : email,
        address: address === '' ? null : address,
        currency: currency.toUpperCase(),
        workingHours,
      });
      toast.success('clinic.updated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  if (clinic.isPending) {
    return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  }

  return (
    <>
      <PageHeader
        title="clinic.title"
        subtitle={canEdit ? 'clinic.subtitle' : 'clinic.readOnly'}
        actions={
          canEdit ? (
            <Button isLoading={updateClinic.isPending} onClick={() => void save()}>
              {t('common.save')}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4">
            <FormField label="clinic.name" htmlFor="clinic-name">
              <Input
                id="clinic-name"
                value={name}
                disabled={!canEdit}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.phone" htmlFor="clinic-phone" optional>
              <Input
                id="clinic-phone"
                inputMode="tel"
                value={phone}
                disabled={!canEdit}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.email" htmlFor="clinic-email" optional>
              <Input
                id="clinic-email"
                type="email"
                value={email}
                disabled={!canEdit}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.address" htmlFor="clinic-address" optional>
              <Input
                id="clinic-address"
                value={address}
                disabled={!canEdit}
                onChange={(event) => setAddress(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.currency" htmlFor="clinic-currency" hint="clinic.currencyHint">
              <Input
                id="clinic-currency"
                maxLength={3}
                className="w-32 uppercase"
                value={currency}
                disabled={!canEdit}
                onChange={(event) => setCurrency(event.target.value)}
              />
            </FormField>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-800">{t('clinic.logo')}</p>
            <div className="mt-2 flex items-center gap-3">
              <div
                aria-label={t('clinic.logoPlaceholder')}
                className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-2xl text-gray-300"
              >
                &#9633;
              </div>

              <div className="flex flex-col items-start gap-1">
                <p className="text-xs text-gray-500">{t('clinic.logoPlaceholder')}</p>
                {/* R2 presigned upload is wired up with the attachments work. */}
                <Button variant="secondary" size="sm" disabled title={t('clinic.logoComingSoon')}>
                  {t('clinic.uploadLogo')}
                </Button>
                <p className="text-xs text-gray-400">{t('clinic.logoComingSoon')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-gray-800">{t('clinic.workingHours')}</p>
          <ScheduleEditor value={workingHours} onChange={setWorkingHours} disabled={!canEdit} />
        </section>
      </div>
    </>
  );
}
