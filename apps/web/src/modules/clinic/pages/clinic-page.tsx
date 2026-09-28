import {
  ALLOWED_CLINIC_LOGO_MIME_TYPES,
  CURRENCIES,
  DEFAULT_PHONE_COUNTRY,
  isPhoneCountry,
  MAX_CLINIC_LOGO_BYTES,
  PHONE_COUNTRIES,
  USER_ROLE,
  type Currency,
  type PhoneCountry,
  type WeeklySchedule,
} from "@clinic/shared";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Flag,
  FormField,
  Icon,
  Img,
  Input,
  Ltr,
  PageHeader,
  PhoneInput,
  Select,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { WorkingHours } from "@web/shared/components/working-hours";
import { isShortMapLink, mapsUrl, parseCoordinates } from "@clinic/shared";
import { SkeletonForm } from "@clinic/ui/components/skeleton";
import { InstallCard } from "@web/shared/components/pwa/install-card";
import { ClosuresPanel } from "@web/modules/schedule/components/closures-panel";
import { useSession } from "@web/shared/providers/session";
import { useApiVersion } from "@web/modules/clinic/queries";
import { WEB_VERSION } from "@web/shared/constants/app";
import {
  useRemoveAppIcon,
  useRemoveClinicLogo,
  useResolveLocation,
  useUpdateClinic,
  useUploadAppIcon,
  useUploadClinicLogo,
} from "@web/modules/clinic/queries";
import { useClinic } from "@web/shared/queries/clinic";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { setClinicTimeZone } from "@web/shared/lib/clinic-zone";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { CLINIC_APP_ICON_LABELS, CLINIC_LOGO_LABELS } from "@web/modules/clinic/constants";

const isCurrency = (value: string): value is Currency =>
  (CURRENCIES as readonly string[]).includes(value);

export function ClinicPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { hasRole, refreshProfile } = useSession();
  const canEdit = hasRole(USER_ROLE.ADMIN);

  const clinic = useClinic();
  const showSkeleton = useDelayedLoading(clinic.isPending);
  const updateClinic = useUpdateClinic();
  const resolveLocation = useResolveLocation();

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const countryNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: "region" }),
    [i18n.language],
  );
  const [workingHours, setWorkingHours] = useState<WeeklySchedule>([]);

  useEffect(() => {
    const data = clinic.data;

    if (!data) {
      return;
    }

    setNameAr(data.name.ar);
    setNameEn(data.name.en);
    setPhone(data.phone ?? "");
    setEmail(data.email ?? "");
    setAddress(data.address ?? "");
    const stored =
      data.latitude && data.longitude
        ? parseCoordinates(`${data.latitude}, ${data.longitude}`)
        : null;

    setLocation(stored ? `${stored.latitude}, ${stored.longitude}` : "");
    setCurrency(isCurrency(data.currency) ? data.currency : CURRENCIES[0]);
    setCountry(isPhoneCountry(data.country) ? data.country : DEFAULT_PHONE_COUNTRY);
    setWorkingHours(data.workingHours);
    setClinicTimeZone(data);
  }, [clinic.data]);

  const pin = parseCoordinates(location);
  const shortLink = pin === null && isShortMapLink(location);
  const unreadable = location.trim() !== "" && pin === null && !shortLink;

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
        phone: phone === "" ? null : phone,
        email: email === "" ? null : email,
        address: address === "" ? null : address,
        latitude: pin?.latitude ?? null,
        longitude: pin?.longitude ?? null,
        currency,
        country,
        workingHours,
      });
      void refreshProfile();
      toast.success("clinic.updated");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  if (clinic.isPending) {
    return showSkeleton ? <SkeletonForm fields={6} /> : <></>;
  }

  return (
    <div data-testid="clinic-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="clinic-header"
        title="clinic.title"
        subtitle={canEdit ? "clinic.subtitle" : "clinic.readOnly"}
        actions={
          canEdit ? (
            <Button
              icon={<Icon name="check" />}
              data-testid="clinic-save"
              isLoading={updateClinic.isPending}
              onClick={() => void save()}
            >
              {t("common.save")}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          data-testid="clinic-details"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="clinic.nameAr" htmlFor="clinic-name-ar">
                <Input
                  placeholder={t("common.placeholders.fullNameAr")}
                  id="clinic-name-ar"
                  data-testid="clinic-field-name-ar"
                  value={nameAr}
                  disabled={!canEdit}
                  onChange={(event) => setNameAr(event.target.value)}
                />
              </FormField>

              <FormField label="clinic.nameEn" htmlFor="clinic-name-en">
                <Input
                  placeholder={t("common.placeholders.fullNameEn")}
                  id="clinic-name-en"
                  data-testid="clinic-field-name-en"
                  dir="ltr"
                  value={nameEn}
                  disabled={!canEdit}
                  onChange={(event) => setNameEn(event.target.value)}
                />
              </FormField>
            </div>

            <FormField label="clinic.phone" htmlFor="clinic-phone" optional>
              <PhoneInput
                placeholder={t("common.placeholders.phone")}
                id="clinic-phone"
                data-testid="clinic-field-phone"
                value={phone}
                disabled={!canEdit}
                onChange={(next) => setPhone(next ?? "")}
              />
            </FormField>

            <FormField label="clinic.email" htmlFor="clinic-email" optional>
              <Input
                placeholder={t("common.placeholders.email")}
                adornment="mail"
                id="clinic-email"
                data-testid="clinic-field-email"
                type="email"
                value={email}
                disabled={!canEdit}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            <FormField label="clinic.address" htmlFor="clinic-address" optional>
              <Input
                placeholder={t("common.placeholders.address")}
                id="clinic-address"
                data-testid="clinic-field-address"
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
                    ? "clinic.locationResolving"
                    : "clinic.locationHint"
              }
              errorKey={
                unreadable
                  ? resolveLocation.isError
                    ? "clinic.locationShortLinkFailed"
                    : "clinic.locationUnreadable"
                  : undefined
              }
              error={unreadable ? { type: "custom" } : undefined}
              optional
            >
              <Input
                placeholder={t("common.placeholders.location")}
                adornment="map-pin"
                id="clinic-location"
                data-testid="clinic-field-location"
                dir="ltr"
                value={location}
                hasError={unreadable}
                disabled={!canEdit}
                onChange={(event) => setLocation(event.target.value)}
              />
            </FormField>

            {pin && (
              <p
                data-testid="clinic-location-pin"
                className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-ink-muted"
              >
                <Ltr className="tabular-nums">{`${pin.latitude}, ${pin.longitude}`}</Ltr>
                <a
                  href={mapsUrl(pin)}
                  data-testid="clinic-location-verify"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary-600 underline underline-offset-2 hover:text-primary-700"
                >
                  {t("clinic.locationVerify")}
                </a>
              </p>
            )}

            <FormField label="clinic.currency" htmlFor="clinic-currency" hint="clinic.currencyHint">
              <Select
                id="clinic-currency"
                data-testid="clinic-field-currency"
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

            <FormField label="clinic.country" htmlFor="clinic-country" hint="clinic.countryHint">
              <Select
                id="clinic-country"
                data-testid="clinic-field-country"
                className="w-56"
                value={country}
                disabled={!canEdit}
                options={PHONE_COUNTRIES.map((entry) => ({
                  value: entry.country,
                  label: `${countryNames.of(entry.country) ?? entry.country} ${entry.dial}`,
                  icon: <Flag country={entry.country} />,
                }))}
                onChange={(event) => {
                  if (isPhoneCountry(event.target.value)) {
                    setCountry(event.target.value);
                  }
                }}
              />
            </FormField>
          </div>

          <div data-testid="clinic-logo-section" className="mt-6 border-t border-line pt-4">
            <p className="text-value font-medium text-ink">{t("clinic.logo")}</p>
            <LogoField src={clinic.data?.logoUrl ?? null} canEdit={canEdit} />
          </div>

          <div data-testid="clinic-app-icon-section" className="mt-6 border-t border-line pt-4">
            <p className="text-value font-medium text-ink">{t("clinic.appIcon")}</p>
            <AppIconField src={clinic.data?.appIconUrl ?? null} canEdit={canEdit} />
          </div>
        </section>

        <section
          data-testid="clinic-working-hours"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <p className="mb-3 text-value font-medium text-ink">{t("clinic.workingHours")}</p>
          <WorkingHours
            value={workingHours}
            onChange={setWorkingHours}
            disabled={!canEdit}
            idPrefix="clinic-hours"
          />
        </section>

        <section
          data-testid="clinic-closures"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <ClosuresPanel canEdit={canEdit} />
        </section>

        <AboutSection />
      </div>
    </div>
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
    readonly confirmTitle: string;
    readonly confirmConsequence: string;
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
  const { confirm, dialog } = useConfirm("branding-image-confirm-remove");
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }

    if (!ALLOWED_CLINIC_LOGO_MIME_TYPES.some((allowed) => allowed === file.type)) {
      toast.error("clinic.logoUnsupported");
      return;
    }

    if (file.size > MAX_CLINIC_LOGO_BYTES) {
      toast.error("clinic.logoTooLarge");
      return;
    }

    try {
      await upload.mutateAsync(file);
      toast.success(labels.uploaded);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const clear = (): void =>
    confirm({
      title: labels.confirmTitle,
      consequences: [t(labels.confirmConsequence)],
      onConfirm: async () => {
        try {
          await remove.mutateAsync();
          toast.success(labels.removed);
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });

  return (
    <div data-testid="branding-image-field" className="mt-2 flex items-center gap-3">
      {dialog}
      {src ? (
        <Img
          data-testid="branding-image"
          src={src}
          alt={t(labels.alt)}
          width={64}
          height={64}
          fit="contain"
          className="rounded-control border border-line bg-surface p-1"
        />
      ) : (
        <span
          data-testid="branding-image-placeholder"
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
              data-testid="branding-image-input"
              className="hidden"
              accept={ALLOWED_CLINIC_LOGO_MIME_TYPES.join(",")}
              onChange={(event) => {
                void pick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <Button
              icon={<Icon name="upload" />}
              variant="secondary"
              size="sm"
              data-testid="branding-image-upload"
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
                data-testid="branding-image-remove"
                isLoading={remove.isPending}
                onClick={clear}
              >
                {t("common.delete")}
              </Button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

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
      labels={CLINIC_LOGO_LABELS}
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
      labels={CLINIC_APP_ICON_LABELS}
      upload={upload}
      remove={remove}
    />
  );
}

function AboutSection(): JSX.Element {
  const { t } = useTranslation();
  const api = useApiVersion();

  const apiVersion = api.data?.version;
  const mismatched = apiVersion !== undefined && apiVersion !== WEB_VERSION;

  return (
    <section
      data-testid="clinic-about"
      className="border border-line rounded-card bg-surface shadow-card p-4"
    >
      <p className="mb-3 text-value font-medium text-ink">{t("clinic.about")}</p>

      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-label text-ink-muted">{t("clinic.version")}</dt>
          <Ltr as="dd" data-testid="clinic-web-version" className="font-mono text-value text-ink">
            v{WEB_VERSION}
          </Ltr>
        </div>

        {mismatched && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-label text-ink-muted">{t("clinic.apiVersion")}</dt>
            <Ltr
              as="dd"
              data-testid="clinic-api-version"
              className="font-mono text-value text-warning-700"
            >
              v{apiVersion}
            </Ltr>
          </div>
        )}
      </dl>

      {mismatched && (
        <p data-testid="clinic-version-mismatch" className="mt-2 text-label text-ink-subtle">
          {t("clinic.versionMismatch")}
        </p>
      )}

      <InstallCard />
    </section>
  );
}
