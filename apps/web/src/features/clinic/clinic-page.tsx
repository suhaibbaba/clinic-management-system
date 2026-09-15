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

import {
  Button,
  FormField,
  Icon,
  Img,
  Input,
  Ltr,
  PageHeader,
  PhoneInput,
  Select,
  useToast,
} from '@clinic/ui';
import { WorkingHours } from '@web/components/schedule/working-hours';
import { isShortMapLink, mapsUrl, parseCoordinates } from '@clinic/shared';
import { SkeletonForm } from '@clinic/ui/components/skeleton';
import { InstallCard } from '@web/components/pwa/install-card';
import { ClosuresPanel } from '@web/features/schedule/closures-panel';
import { useSession } from '@web/features/auth/session';
import { useApiVersion, WEB_VERSION } from '@web/features/clinic/api-version';
import {
  useClinic,
  useRemoveAppIcon,
  useRemoveClinicLogo,
  useResolveLocation,
  useUpdateClinic,
  useUploadAppIcon,
  useUploadClinicLogo,
} from '@web/features/clinic/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { setClinicTimeZone } from '@web/lib/clinic-zone';
import { useDelayedLoading } from '@clinic/ui/lib/use-delayed-loading';

const isCurrency = (value: string): value is Currency =>
  (CURRENCIES as readonly string[]).includes(value);

/** Admin edits; every other role sees the same screen read-only (ROLES.md). */
export function ClinicPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { hasRole } = useSession();
  const canEdit = hasRole(USER_ROLE.ADMIN);

  const clinic = useClinic();
  const showSkeleton = useDelayedLoading(clinic.isPending);
  const updateClinic = useUpdateClinic();
  const resolveLocation = useResolveLocation();

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState('');
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
  const [workingHours, setWorkingHours] = useState<WeeklySchedule>([]);

  useEffect(() => {
    const data = clinic.data;

    if (!data) {
      return;
    }

    setNameAr(data.name.ar);
    setNameEn(data.name.en);
    setPhone(data.phone ?? '');
    setEmail(data.email ?? '');
    setAddress(data.address ?? '');
    // Through the parser on the way in too: `numeric(9,6)` reads back as `32.221000`, and a box
    // full of trailing zeros looks like something the screen did rather than something you typed.
    const stored =
      data.latitude && data.longitude
        ? parseCoordinates(`${data.latitude}, ${data.longitude}`)
        : null;

    setLocation(stored ? `${stored.latitude}, ${stored.longitude}` : '');
    setCurrency(isCurrency(data.currency) ? data.currency : CURRENCIES[0]);
    setWorkingHours(data.workingHours);
    setClinicTimeZone(data);
  }, [clinic.data]);

  const pin = parseCoordinates(location);
  const shortLink = pin === null && isShortMapLink(location);
  const unreadable = location.trim() !== '' && pin === null && !shortLink;

  useEffect(() => {
    if (!shortLink) {
      return;
    }

    let cancelled = false;

    void resolveLocation
      .mutateAsync(location.trim())
      .then((resolved) => {
        if (!cancelled) {
          setLocation(`${resolved.latitude}, ${resolved.longitude}`);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [shortLink, location]);

  const save = async (): Promise<void> => {
    try {
      await updateClinic.mutateAsync({
        name: { ar: nameAr, en: nameEn },
        phone: phone === '' ? null : phone,
        email: email === '' ? null : email,
        address: address === '' ? null : address,
        latitude: pin?.latitude ?? null,
        longitude: pin?.longitude ?? null,
        currency,
        workingHours,
      });
      toast.success('clinic.updated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  if (clinic.isPending) {
    return showSkeleton ? <SkeletonForm fields={6} /> : <></>;
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
        <section className="border border-line rounded-card bg-surface shadow-card p-4">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="clinic.nameAr" htmlFor="clinic-name-ar">
                <Input
                  placeholder={t('common.placeholders.fullNameAr')}
                  id="clinic-name-ar"
                  value={nameAr}
                  disabled={!canEdit}
                  onChange={(event) => setNameAr(event.target.value)}
                />
              </FormField>

              <FormField label="clinic.nameEn" htmlFor="clinic-name-en">
                <Input
                  placeholder={t('common.placeholders.fullNameEn')}
                  id="clinic-name-en"
                  dir="ltr"
                  value={nameEn}
                  disabled={!canEdit}
                  onChange={(event) => setNameEn(event.target.value)}
                />
              </FormField>
            </div>

            <FormField label="clinic.phone" htmlFor="clinic-phone" optional>
              <PhoneInput
                placeholder={t('common.placeholders.phone')}
                adornment="phone"
                id="clinic-phone"
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

            <FormField
              label="clinic.location"
              htmlFor="clinic-location"
              hint={
                unreadable
                  ? undefined
                  : shortLink
                    ? 'clinic.locationResolving'
                    : 'clinic.locationHint'
              }
              errorKey={
                unreadable
                  ? resolveLocation.isError
                    ? 'clinic.locationShortLinkFailed'
                    : 'clinic.locationUnreadable'
                  : undefined
              }
              error={unreadable ? { type: 'custom' } : undefined}
              optional
            >
              <Input
                placeholder={t('common.placeholders.location')}
                adornment="map-pin"
                id="clinic-location"
                dir="ltr"
                value={location}
                hasError={unreadable}
                disabled={!canEdit}
                onChange={(event) => setLocation(event.target.value)}
              />
            </FormField>

            {/* What was understood, and a way to check it before it is saved: a pin in the wrong
                street looks exactly like a pin in the right one until somebody opens it. */}
            {pin && (
              <p className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-ink-muted">
                <Ltr className="tabular-nums">{`${pin.latitude}, ${pin.longitude}`}</Ltr>
                <a
                  href={mapsUrl(pin)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary-600 underline underline-offset-2 hover:text-primary-700"
                >
                  {t('clinic.locationVerify')}
                </a>
              </p>
            )}

            <FormField label="clinic.currency" htmlFor="clinic-currency" hint="clinic.currencyHint">
              <Select
                id="clinic-currency"
                className="w-56"
                value={currency}
                disabled={!canEdit}
                options={CURRENCIES.map((code) => ({
                  value: code,
                  label: `${t(`clinic.currencies.${code}`)} (${code})`,
                }))}
                onChange={(event) => setCurrency(event.target.value as Currency)}
              />
            </FormField>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-value font-medium text-ink">{t('clinic.logo')}</p>
            <LogoField src={clinic.data?.logoUrl ?? null} canEdit={canEdit} />
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-value font-medium text-ink">{t('clinic.appIcon')}</p>
            <AppIconField src={clinic.data?.appIconUrl ?? null} canEdit={canEdit} />
          </div>
        </section>

        <section className="border border-line rounded-card bg-surface shadow-card p-4">
          <p className="mb-3 text-value font-medium text-ink">{t('clinic.workingHours')}</p>
          <WorkingHours
            value={workingHours}
            onChange={setWorkingHours}
            disabled={!canEdit}
            idPrefix="clinic-hours"
          />
        </section>

        <section className="border border-line rounded-card bg-surface shadow-card p-4">
          <ClosuresPanel canEdit={canEdit} />
        </section>

        <AboutSection />
      </div>
    </>
  );
}

interface BrandingImageFieldProps {
  readonly src: string | null;
  readonly canEdit: boolean;
  readonly labels: {
    readonly alt: string;
    readonly placeholder: string;
    readonly hint: string;
    readonly upload: string;
    readonly replace: string;
    readonly uploaded: string;
    readonly removed: string;
  };
  readonly upload: ReturnType<typeof useUploadClinicLogo>;
  readonly remove: ReturnType<typeof useRemoveClinicLogo>;
}

function BrandingImageField({
  src,
  canEdit,
  labels,
  upload,
  remove,
}: BrandingImageFieldProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

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
      toast.success(labels.uploaded);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const clear = async (): Promise<void> => {
    try {
      await remove.mutateAsync();
      toast.success(labels.removed);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div className="mt-2 flex items-center gap-3">
      {src ? (
        <Img
          src={src}
          alt={t(labels.alt)}
          width={64}
          height={64}
          // `contain`: a wide wordmark and a round badge both sit inside the
          // box without either being cropped or stretched.
          fit="contain"
          className="rounded-control border border-line bg-surface p-1"
        />
      ) : (
        <span
          aria-label={t(labels.placeholder)}
          className="flex size-16 shrink-0 items-center justify-center rounded-control border border-dashed border-line-strong text-ink-subtle"
        >
          <Icon name="image" />
        </span>
      )}

      <div className="flex flex-col items-start gap-1">
        <p className="text-label text-ink-muted">{t(labels.hint)}</p>

        {canEdit && (
          <span className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_CLINIC_LOGO_MIME_TYPES.join(',')}
              onChange={(event) => {
                void pick(event.target.files?.[0]);
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
              {t(src ? labels.replace : labels.upload)}
            </Button>

            {src && (
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

const LOGO_LABELS = {
  alt: 'clinic.logo',
  placeholder: 'clinic.logoPlaceholder',
  hint: 'clinic.logoHint',
  upload: 'clinic.uploadLogo',
  replace: 'clinic.replaceLogo',
  uploaded: 'clinic.logoUpdated',
  removed: 'clinic.logoRemoved',
} as const;

const APP_ICON_LABELS = {
  alt: 'clinic.appIcon',
  placeholder: 'clinic.appIconPlaceholder',
  hint: 'clinic.appIconHint',
  upload: 'clinic.uploadAppIcon',
  replace: 'clinic.replaceAppIcon',
  uploaded: 'clinic.appIconUpdated',
  removed: 'clinic.appIconRemoved',
} as const;

function LogoField({
  src,
  canEdit,
}: {
  readonly src: string | null;
  readonly canEdit: boolean;
}): JSX.Element {
  const upload = useUploadClinicLogo();
  const remove = useRemoveClinicLogo();

  return (
    <BrandingImageField
      src={src}
      canEdit={canEdit}
      labels={LOGO_LABELS}
      upload={upload}
      remove={remove}
    />
  );
}

function AppIconField({
  src,
  canEdit,
}: {
  readonly src: string | null;
  readonly canEdit: boolean;
}): JSX.Element {
  const upload = useUploadAppIcon();
  const remove = useRemoveAppIcon();

  return (
    <BrandingImageField
      src={src}
      canEdit={canEdit}
      labels={APP_ICON_LABELS}
      upload={upload}
      remove={remove}
    />
  );
}

// Every role sees it: a version is not a permission. The API's is shown only when the two disagree,
// which is a browser still holding the previous bundle.
function AboutSection(): JSX.Element {
  const { t } = useTranslation();
  const api = useApiVersion();

  const apiVersion = api.data?.version;
  const mismatched = apiVersion !== undefined && apiVersion !== WEB_VERSION;

  return (
    <section className="border border-line rounded-card bg-surface shadow-card p-4">
      <p className="mb-3 text-value font-medium text-ink">{t('clinic.about')}</p>

      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-label text-ink-muted">{t('clinic.version')}</dt>
          <Ltr as="dd" className="font-mono text-value text-ink">
            v{WEB_VERSION}
          </Ltr>
        </div>

        {mismatched && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-label text-ink-muted">{t('clinic.apiVersion')}</dt>
            <Ltr as="dd" className="font-mono text-value text-warning-700">
              v{apiVersion}
            </Ltr>
          </div>
        )}
      </dl>

      {mismatched && (
        <p className="mt-2 text-label text-ink-subtle">{t('clinic.versionMismatch')}</p>
      )}

      <InstallCard />
    </section>
  );
}
