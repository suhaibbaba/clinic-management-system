import { CURRENCIES, USER_ROLE, type Currency, type WeeklySchedule } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Icon, Input, PageHeader, Select, useToast } from '@web/components/ui';
import { ScheduleEditor } from '@web/components/schedule-editor';
import { useSession } from '@web/features/auth/session';
import { useClinic, useUpdateClinic } from '@web/features/clinic/queries';
import { errorMessageKey } from '@web/lib/api-error';

const isCurrency = (value: string): value is Currency =>
  (CURRENCIES as readonly string[]).includes(value);

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
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
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
    // A clinic saved before the list existed can hold anything; keep the
    // select on a value it actually offers rather than showing a blank box.
    setCurrency(isCurrency(data.currency) ? data.currency : CURRENCIES[0]);
    setWorkingHours(data.workingHours);
  }, [clinic.data]);

  const save = async (): Promise<void> => {
    try {
      await updateClinic.mutateAsync({
        name,
        phone: phone === '' ? null : phone,
        email: email === '' ? null : email,
        address: address === '' ? null : address,
        currency,
        workingHours,
      });
      toast.success('clinic.updated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  if (clinic.isPending) {
    return <p className="text-value text-ink-muted">{t('common.loading')}</p>;
  }

  return (
    <>
      <PageHeader
        title="clinic.title"
        subtitle={canEdit ? 'clinic.subtitle' : 'clinic.readOnly'}
        actions={
          canEdit ? (
            <Button
              icon={<Icon name="check" />}
              isLoading={updateClinic.isPending}
              onClick={() => void save()}
            >
              {t('common.save')}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card bg-surface shadow-card p-4">
          <div className="flex flex-col gap-4">
            <FormField label="clinic.name" htmlFor="clinic-name">
              <Input
                placeholder={t('common.placeholders.fullName')}
                id="clinic-name"
                value={name}
                disabled={!canEdit}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.phone" htmlFor="clinic-phone" optional>
              <Input
                placeholder={t('common.placeholders.phone')}
                adornment="phone"
                id="clinic-phone"
                inputMode="tel"
                value={phone}
                disabled={!canEdit}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.email" htmlFor="clinic-email" optional>
              <Input
                placeholder={t('common.placeholders.email')}
                adornment="mail"
                id="clinic-email"
                type="email"
                value={email}
                disabled={!canEdit}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.address" htmlFor="clinic-address" optional>
              <Input
                placeholder={t('common.placeholders.address')}
                id="clinic-address"
                value={address}
                disabled={!canEdit}
                onChange={(event) => setAddress(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.currency" htmlFor="clinic-currency" hint="clinic.currencyHint">
              <Select
                id="clinic-currency"
                className="w-56"
                value={currency}
                disabled={!canEdit}
                options={CURRENCIES.map((code) => ({
                  value: code,
                  // "US dollar (USD)" — the code alone is what appears beside
                  // every figure, so it stays visible next to the name.
                  label: `${t(`clinic.currencies.${code}`)} (${code})`,
                }))}
                onChange={(event) => setCurrency(event.target.value as Currency)}
              />
            </FormField>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-value font-medium text-ink">{t('clinic.logo')}</p>
            <div className="mt-2 flex items-center gap-3">
              <div
                aria-label={t('clinic.logoPlaceholder')}
                className="flex size-16 shrink-0 items-center justify-center rounded-control border border-dashed border-line-strong text-2xl text-ink-subtle"
              >
                &#9633;
              </div>

              <div className="flex flex-col items-start gap-1">
                <p className="text-label text-ink-muted">{t('clinic.logoPlaceholder')}</p>
                {/* R2 presigned upload is wired up with the attachments work. */}
                <Button
                  icon={<Icon name="upload" />}
                  variant="secondary"
                  size="sm"
                  disabled
                  title={t('clinic.logoComingSoon')}
                >
                  {t('clinic.uploadLogo')}
                </Button>
                <p className="text-label text-ink-subtle">{t('clinic.logoComingSoon')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-card bg-surface shadow-card p-4">
          <p className="mb-3 text-value font-medium text-ink">{t('clinic.workingHours')}</p>
          <ScheduleEditor value={workingHours} onChange={setWorkingHours} disabled={!canEdit} />
        </section>
      </div>
    </>
  );
}
