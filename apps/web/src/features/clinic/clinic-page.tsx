import {
  ALLOWED_CLINIC_LOGO_MIME_TYPES,
  CURRENCIES,
  MAX_CLINIC_LOGO_BYTES,
  USER_ROLE,
  type Currency,
  type WeeklySchedule,
} from '@clinic/shared';
import { useEffect, useRef, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Icon, Input, PageHeader, Select, useToast } from '@web/components/ui';
import { ScheduleEditor } from '@web/components/schedule-editor';
import { useSession } from '@web/features/auth/session';
import { useApiVersion, WEB_VERSION } from '@web/features/clinic/api-version';
import {
  useClinic,
  useRemoveClinicLogo,
  useUpdateClinic,
  useUploadClinicLogo,
} from '@web/features/clinic/queries';
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
            <LogoField logoUrl={clinic.data?.logoUrl ?? null} canEdit={canEdit} />
          </div>
        </section>

        <section className="rounded-card bg-surface shadow-card p-4">
          <p className="mb-3 text-value font-medium text-ink">{t('clinic.workingHours')}</p>
          <ScheduleEditor value={workingHours} onChange={setWorkingHours} disabled={!canEdit} />
        </section>

        <AboutSection />
      </div>
    </>
  );
}

/**
 * The clinic's mark: on screen here, in the sidebar, on the sign-in page and
 * at the top of every printed document.
 *
 * The size limit is checked before the file leaves the browser as well as
 * after it lands, because a two-megabyte ceiling that only announces itself
 * after a slow upload is not a limit anyone can work with. The API checks the
 * stored bytes again, which is the real gate — this one is a courtesy.
 */
function LogoField({
  logoUrl,
  canEdit,
}: {
  readonly logoUrl: string | null;
  readonly canEdit: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadClinicLogo();
  const remove = useRemoveClinicLogo();

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }

    if (!ALLOWED_CLINIC_LOGO_MIME_TYPES.some((allowed) => allowed === file.type)) {
      toast.error('clinic.logoUnsupported');
      return;
    }

    if (file.size > MAX_CLINIC_LOGO_BYTES) {
      toast.error('clinic.logoTooLarge');
      return;
    }

    try {
      await upload.mutateAsync(file);
      toast.success('clinic.logoUpdated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const clear = async (): Promise<void> => {
    try {
      await remove.mutateAsync();
      toast.success('clinic.logoRemoved');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div className="mt-2 flex items-center gap-3">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={t('clinic.logo')}
          // Square-ish box, `contain`: a wide wordmark and a round badge both
          // sit inside it without either being cropped or stretched.
          className="size-16 shrink-0 rounded-control border border-line bg-surface object-contain p-1"
        />
      ) : (
        <span
          aria-label={t('clinic.logoPlaceholder')}
          className="flex size-16 shrink-0 items-center justify-center rounded-control border border-dashed border-line-strong text-ink-subtle"
        >
          <Icon name="image" />
        </span>
      )}

      <div className="flex flex-col items-start gap-1">
        <p className="text-label text-ink-muted">{t('clinic.logoHint')}</p>

        {canEdit && (
          <span className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_CLINIC_LOGO_MIME_TYPES.join(',')}
              onChange={(event) => {
                void pick(event.target.files?.[0]);
                // Cleared so picking the same file twice still fires a change.
                event.target.value = '';
              }}
            />

            <Button
              icon={<Icon name="upload" />}
              variant="secondary"
              size="sm"
              isLoading={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {t(logoUrl ? 'clinic.replaceLogo' : 'clinic.uploadLogo')}
            </Button>

            {logoUrl && (
              <Button
                icon={<Icon name="trash" />}
                variant="secondary"
                size="sm"
                isLoading={remove.isPending}
                onClick={() => void clear()}
              >
                {t('common.delete')}
              </Button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Which build this is — the thing somebody reads out over the phone when they
 * report a problem.
 *
 * Every role sees it: a version is not a permission, and the person on the
 * phone is as likely to be the receptionist as the admin.
 *
 * The number is the bundle's own, baked in at build time. The API's is shown
 * **only when the two disagree**, which is the case worth surfacing: a browser
 * still holding the previous bundle after a deploy. When they agree, a second
 * identical number would be noise.
 */
function AboutSection(): JSX.Element {
  const { t } = useTranslation();
  const api = useApiVersion();

  const apiVersion = api.data?.version;
  const mismatched = apiVersion !== undefined && apiVersion !== WEB_VERSION;

  return (
    <section className="rounded-card bg-surface shadow-card p-4">
      <p className="mb-3 text-value font-medium text-ink">{t('clinic.about')}</p>

      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-label text-ink-muted">{t('clinic.version')}</dt>
          <dd dir="ltr" className="font-mono text-value text-ink">
            v{WEB_VERSION}
          </dd>
        </div>

        {mismatched && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-label text-ink-muted">{t('clinic.apiVersion')}</dt>
            <dd dir="ltr" className="font-mono text-value text-warning-700">
              v{apiVersion}
            </dd>
          </div>
        )}
      </dl>

      {mismatched && (
        <p className="mt-2 text-label text-ink-subtle">{t('clinic.versionMismatch')}</p>
      )}
    </section>
  );
}
