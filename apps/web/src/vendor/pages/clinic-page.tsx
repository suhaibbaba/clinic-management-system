import {
  addDays,
  localized,
  shortDate,
  SPECIALTY_CODE,
  SUBSCRIPTION_STATUSES,
  type ClinicModule,
  type Plan,
  type SaveSubscriptionInput,
  type SpecialtyCode,
  type SubscriptionStatus,
  type VendorClinicDetail,
} from "@clinic/shared";
import { Badge } from "@clinic/ui/components/badge";
import { Button } from "@clinic/ui/components/button";
import { Checkbox } from "@clinic/ui/components/checkbox";
import { DatePicker } from "@clinic/ui/components/date-picker";
import { FormField } from "@clinic/ui/components/form-field";
import { Input } from "@clinic/ui/components/input";
import { Select } from "@clinic/ui/components/select";
import { Textarea } from "@clinic/ui/components/textarea";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { ModuleList } from "@web/vendor/components/module-list";
import { ModulePicker } from "@web/vendor/components/module-picker";
import { StatusBadge } from "@web/vendor/components/status-badge";
import { ClinicMark } from "@web/vendor/components/clinic-mark";
import { useClinicActions } from "@web/vendor/hooks/use-clinic-actions";
import type { VendorLocation } from "@web/vendor/hooks/use-location";
import { Icon } from "@clinic/ui/components/icon";
import { Tabs } from "@clinic/ui/components/tabs";
import { VendorLink } from "@web/vendor/components/vendor-link";
import { vendorPath } from "@web/vendor/lib/route";
import {
  initialSubscription,
  isReadOnly,
  lacksDependency,
  resultingModules,
} from "@web/vendor/lib/subscription";
import { VENDOR_CLINIC_TABS, VENDOR_PARAM, VENDOR_TRIAL_DAYS } from "@web/vendor/constants";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import {
  useClinic,
  useGrantSpecialty,
  usePlans,
  useSaveDomain,
  useSaveSubscription,
} from "@web/vendor/queries";
import { clinicAddresses, parseDomain } from "@web/vendor/lib/domain";

type ClinicTab = (typeof VENDOR_CLINIC_TABS)[number];

export function ClinicPage({
  id,
  location,
}: {
  readonly id: string;
  readonly location: VendorLocation;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const { navigate, params } = location;
  const clinic = useClinic(id);
  const plans = usePlans();
  const { actionsFor, dialog } = useClinicActions(() => navigate(vendorPath({ kind: "clinics" })));
  const tab: ClinicTab =
    VENDOR_CLINIC_TABS.find((entry) => entry === params.get(VENDOR_PARAM.TAB)) ?? "subscription";
  const openTab = (next: ClinicTab): void =>
    navigate(
      `${vendorPath({ kind: "clinic", id })}${next === "subscription" ? "" : `?${VENDOR_PARAM.TAB}=${next}`}`,
      { replace: true },
    );

  if (clinic.isError) {
    return <p className="text-ink-muted">{t(vendorErrorKey(clinic.error))}</p>;
  }

  if (!clinic.data || !plans.data) {
    return <div className="skeleton h-64 rounded-card" aria-hidden="true" />;
  }

  const detail = clinic.data;
  const act = actionsFor(detail);
  const subscription = detail.subscription;
  const plan = plans.data.items.find((entry) => entry.id === subscription?.planId);
  const addresses = detail.domain ? clinicAddresses(detail.domain) : null;

  return (
    <div className="flex flex-col gap-5" data-testid="vendor-clinic">
      <VendorLink
        to={vendorPath({ kind: "clinics" })}
        navigate={navigate}
        className="self-start text-label text-primary-700"
      >
        {t("vendor.clinic.back")}
      </VendorLink>

      {detail.removedAt && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-sunken p-4 text-label text-ink"
        >
          {t("vendor.clinic.removedNote", { date: shortDate(detail.removedAt.slice(0, 10)) })}
          <Button
            variant="secondary"
            icon={<Icon name="reset" />}
            onClick={act.restore}
            data-testid="vendor-restore"
          >
            {t("vendor.actions.restore")}
          </Button>
        </div>
      )}

      <section
        className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5"
        data-testid="vendor-clinic-header"
      >
        <div className="flex flex-wrap items-start gap-4">
          <ClinicMark clinic={detail} size="page" />
          <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-headline font-extrabold text-ink">
                {localized(detail.name, i18n.language)}
              </h1>
              <StatusBadge status={subscription?.status ?? null} />
              {subscription?.endsOn && (
                <span className="text-meta text-ink-muted">
                  {t("vendor.clinic.until", { date: shortDate(subscription.endsOn) })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-label text-ink-muted">
              {addresses ? (
                <>
                  <a
                    href={addresses.website}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="text-primary-700 underline"
                  >
                    {detail.domain}
                  </a>
                  <a
                    href={addresses.dashboard}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="text-primary-700 underline"
                  >
                    {`admin.${detail.domain ?? ""}`}
                  </a>
                </>
              ) : (
                <span dir="ltr">{detail.slug}</span>
              )}
              <span>
                {detail.specialties.length === 0
                  ? "—"
                  : new Intl.ListFormat(i18n.language).format(
                      detail.specialties.map((code) => t(`vendor.specialtyNames.${code}`, code)),
                    )}
              </span>
              <span>
                {t("vendor.clinic.createdOn", { date: shortDate(detail.createdAt.slice(0, 10)) })}
              </span>
            </div>
          </div>
          {!detail.removedAt && (
            <div className="flex flex-wrap gap-2">
              {act.extend && (
                <Button
                  variant="secondary"
                  icon={<Icon name="calendar" />}
                  onClick={act.extend}
                  data-testid="vendor-extend"
                >
                  {t("vendor.actions.extend")}
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<Icon name="trash" />}
                className="text-danger-700"
                onClick={act.remove}
                data-testid="vendor-remove"
              >
                {t("vendor.actions.remove")}
              </Button>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t("vendor.clinic.plan")} value={subscription?.planName ?? "—"} />
          <Stat
            label={t("vendor.clinic.users")}
            value={String(detail.users)}
            {...(plan?.maxUsers != null && {
              extra: t("vendor.clinic.ofLimit", { limit: plan.maxUsers }),
            })}
          />
          <Stat
            label={t("vendor.clinic.doctors")}
            value={String(detail.doctors)}
            {...(plan?.maxDoctors != null && {
              extra: t("vendor.clinic.ofLimit", { limit: plan.maxDoctors }),
            })}
          />
          <Stat label={t("vendor.clinics.columns.modules")} value={String(detail.modules.length)} />
        </dl>
      </section>

      {isReadOnly(subscription?.status ?? null) && !detail.removedAt && (
        <p role="status" className="rounded-panel bg-danger-50 p-3 text-label text-danger-700">
          {t("vendor.clinic.readOnlyNote")}
        </p>
      )}

      <Tabs
        label={t("vendor.clinic.sections")}
        value={tab}
        onChange={openTab}
        tabs={VENDOR_CLINIC_TABS.map((entry) => ({
          id: entry,
          label: t(`vendor.clinic.tabs.${entry}`),
        }))}
        data-testid="vendor-clinic-tabs"
      />

      {tab === "subscription" && (
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[999_1_560px]">
            <SubscriptionForm key={detail.id} detail={detail} plans={plans.data.items} />
          </div>
          <aside className="flex flex-[1_1_280px] flex-col gap-3 rounded-card border border-line bg-surface p-5">
            <h2 className="text-value font-bold text-ink">{t("vendor.clinic.onNow")}</h2>
            <ModuleList modules={detail.modules} />
            <h2 className="mt-2 text-value font-bold text-ink">{t("vendor.clinic.recent")}</h2>
            <EventList events={detail.events.slice(0, 5)} />
            {detail.events.length > 5 && (
              <button
                type="button"
                className="cursor-pointer self-start text-label text-primary-700 underline"
                onClick={() => openTab("history")}
              >
                {t("vendor.clinic.allHistory")}
              </button>
            )}
          </aside>
        </div>
      )}
      {tab === "domain" && <DomainForm key={`domain-${detail.id}`} detail={detail} />}
      {tab === "specialties" && <Specialties detail={detail} />}
      {tab === "history" && <History detail={detail} />}

      {dialog}
    </div>
  );
}

function Stat({
  label,
  value,
  extra,
}: {
  readonly label: string;
  readonly value: string;
  readonly extra?: string;
}): JSX.Element {
  return (
    <div className="rounded-panel bg-canvas px-4 py-3">
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="text-title font-extrabold text-ink">
        {value} {extra && <span className="text-meta font-normal text-ink-muted">{extra}</span>}
      </dd>
    </div>
  );
}

function DomainForm({ detail }: { readonly detail: VendorClinicDetail }): JSX.Element {
  const { t } = useTranslation();
  const save = useSaveDomain(detail.id);
  const [text, setText] = useState(detail.domain ?? "");
  const parsed = parseDomain(text);
  const invalid = parsed === undefined;
  const unchanged = parsed === detail.domain;
  const addresses = detail.domain ? clinicAddresses(detail.domain) : null;

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-domain"
    >
      <h2 className="text-section font-semibold text-ink">{t("vendor.clinic.domain")}</h2>
      <div className="flex max-w-(--form-max) flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <FormField
            label="vendor.clinic.domain"
            htmlFor="vendor-domain-input"
            hint="vendor.clinic.domainHint"
          >
            <Input
              id="vendor-domain-input"
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("vendor.clinic.domainPlaceholder")}
              value={text}
              hasError={invalid}
              onChange={(event) => setText(event.target.value)}
              data-testid="vendor-domain-input"
            />
          </FormField>
        </div>
        <Button
          aria-disabled={invalid || unchanged || undefined}
          isLoading={save.isPending}
          onClick={() => !invalid && !unchanged && save.mutate(parsed)}
          data-testid="vendor-domain-save"
        >
          {t("vendor.clinic.saveDomain")}
        </Button>
      </div>

      {invalid && (
        <p role="alert" className="text-label text-danger-700" data-testid="vendor-domain-invalid">
          {t("vendor.clinic.domainInvalid")}
        </p>
      )}

      {addresses ? (
        <dl
          className="grid gap-2 text-label sm:grid-cols-[auto_1fr]"
          data-testid="vendor-domain-addresses"
        >
          <dt className="text-ink-muted">{t("vendor.clinic.website")}</dt>
          <dd>
            <a
              href={addresses.website}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="text-primary-700 underline"
            >
              {addresses.website}
            </a>
          </dd>
          <dt className="text-ink-muted">{t("vendor.clinic.dashboard")}</dt>
          <dd>
            <a
              href={addresses.dashboard}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="text-primary-700 underline"
            >
              {addresses.dashboard}
            </a>
          </dd>
        </dl>
      ) : (
        <p className="text-meta text-ink-muted">
          {t("vendor.clinic.noDomain", { slug: detail.slug })}
        </p>
      )}

      {save.isError && (
        <p role="alert" className="text-label text-danger-700">
          {t(vendorErrorKey(save.error))}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-label text-success-700">
          {t("vendor.clinic.domainSaved")}
        </p>
      )}
    </section>
  );
}

function SubscriptionForm({
  detail,
  plans,
}: {
  readonly detail: VendorClinicDetail;
  readonly plans: readonly Plan[];
}): JSX.Element {
  const { t } = useTranslation();
  const save = useSaveSubscription(detail.id);
  const [input, setInput] = useState(() => initialSubscription(detail, plans));
  const plan = plans.find((entry) => entry.id === input.planId);
  const planModules: readonly ClinicModule[] = plan?.modules ?? [];
  const modules = resultingModules(planModules, input.addOnModules);
  const blocked = !plan || lacksDependency(modules);
  const update = (patch: Partial<SaveSubscriptionInput>): void =>
    setInput((previous) => ({ ...previous, ...patch }));

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-subscription"
    >
      <h2 className="text-section font-semibold text-ink">{t("vendor.clinic.subscription")}</h2>
      {!detail.subscription && (
        <p className="text-meta text-ink-muted">{t("vendor.clinic.unmanagedNote")}</p>
      )}

      <div className="grid max-w-(--form-max) gap-4 sm:grid-cols-2">
        <FormField label="vendor.clinic.plan" htmlFor="vendor-plan">
          <Select
            id="vendor-plan"
            searchable
            value={input.planId || undefined}
            placeholder={t("vendor.clinic.choosePlan")}
            onChange={(event) =>
              update({
                planId: event.target.value,
                addOnModules: input.addOnModules.filter(
                  (module) =>
                    !plans
                      .find((entry) => entry.id === event.target.value)
                      ?.modules.includes(module),
                ),
              })
            }
            options={plans
              .filter((entry) => entry.isActive || entry.id === input.planId)
              .map((entry) => ({ value: entry.id, label: entry.name }))}
            data-testid="vendor-subscription-plan"
          />
        </FormField>
        <FormField label="vendor.clinic.status" htmlFor="vendor-status">
          <Select
            id="vendor-status"
            value={input.status}
            onChange={(event) => update({ status: event.target.value as SubscriptionStatus })}
            options={SUBSCRIPTION_STATUSES.map((value) => ({
              value,
              label: t(`vendor.status.${value}`),
            }))}
            data-testid="vendor-subscription-status"
          />
        </FormField>
        <FormField label="vendor.clinic.startsOn" htmlFor="vendor-starts">
          <DatePicker
            id="vendor-starts"
            label={t("vendor.clinic.startsOn")}
            value={input.startsOn}
            onChange={(value) => update({ startsOn: value })}
          />
        </FormField>
        <FormField label="vendor.clinic.endsOn" htmlFor="vendor-ends">
          <div className="flex flex-col gap-2">
            {input.endsOn !== null && (
              <DatePicker
                id="vendor-ends"
                label={t("vendor.clinic.endsOn")}
                value={input.endsOn}
                min={input.startsOn}
                onChange={(value) => update({ endsOn: value })}
              />
            )}
            <Checkbox
              checked={input.endsOn === null}
              label={t("vendor.clinic.noEnd")}
              onCheckedChange={(none) =>
                update({ endsOn: none ? null : addDays(input.startsOn, VENDOR_TRIAL_DAYS) })
              }
              data-testid="vendor-subscription-no-end"
            />
          </div>
        </FormField>
        <FormField label="vendor.clinic.graceDays" htmlFor="vendor-grace">
          <Input
            id="vendor-grace"
            inputMode="numeric"
            value={String(input.graceDays)}
            onChange={(event) =>
              update({
                graceDays: Math.min(
                  90,
                  Math.max(0, Number(event.target.value.replaceAll(/\D/g, "")) || 0),
                ),
              })
            }
          />
        </FormField>
      </div>

      <FormField label="vendor.clinic.addOns" htmlFor="vendor-add-ons">
        <ModulePicker
          value={input.addOnModules}
          included={planModules}
          onChange={(addOnModules) => update({ addOnModules })}
          data-testid="vendor-add-ons"
        />
      </FormField>

      <FormField label="vendor.clinic.notes" htmlFor="vendor-notes">
        <Textarea
          id="vendor-notes"
          value={input.notes ?? ""}
          maxLength={500}
          onChange={(event) =>
            update({ notes: event.target.value.trim() === "" ? null : event.target.value })
          }
        />
      </FormField>

      <div className="flex flex-col gap-1">
        <span className="text-label text-ink-muted">{t("vendor.clinic.resulting")}</span>
        <ModuleList modules={modules} />
        {lacksDependency(modules) && (
          <p role="alert" className="text-label text-danger-700">
            {t("vendor.errors.missingModules")}
          </p>
        )}
      </div>

      {save.isError && (
        <p role="alert" className="text-label text-danger-700">
          {t(vendorErrorKey(save.error))}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-label text-success-700">
          {t("vendor.clinic.saved")}
        </p>
      )}

      <div>
        <Button
          aria-disabled={blocked || undefined}
          isLoading={save.isPending}
          onClick={() => !blocked && save.mutate(input)}
          data-testid="vendor-subscription-save"
        >
          {t("vendor.clinic.save")}
        </Button>
      </div>
    </section>
  );
}

function Specialties({ detail }: { readonly detail: VendorClinicDetail }): JSX.Element {
  const { t } = useTranslation();
  const grant = useGrantSpecialty(detail.id);

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-specialties"
    >
      <h2 className="text-section font-semibold text-ink">{t("vendor.clinic.specialties")}</h2>
      <ul className="flex flex-col gap-2">
        {Object.values(SPECIALTY_CODE).map((code: SpecialtyCode) => (
          <li key={code} className="flex items-center justify-between gap-3">
            <span className="text-value text-ink">{t(`vendor.specialtyNames.${code}`)}</span>
            {detail.specialties.includes(code) ? (
              <Badge tone="success">{t("vendor.clinic.granted")}</Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                isLoading={grant.isPending && grant.variables === code}
                onClick={() => grant.mutate(code)}
                data-testid={`vendor-grant-${code}`}
              >
                {t("vendor.clinic.grant")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {grant.isError && (
        <p role="alert" className="text-label text-danger-700">
          {t(vendorErrorKey(grant.error))}
        </p>
      )}
    </section>
  );
}

function History({ detail }: { readonly detail: VendorClinicDetail }): JSX.Element {
  const { t } = useTranslation();

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-history"
    >
      <h2 className="text-section font-semibold text-ink">{t("vendor.clinic.history")}</h2>
      {detail.events.length === 0 ? (
        <p className="text-ink-muted">{t("vendor.clinic.noHistory")}</p>
      ) : (
        <EventList events={detail.events} />
      )}
    </section>
  );
}

function EventList({ events }: { readonly events: VendorClinicDetail["events"] }): JSX.Element {
  const { t } = useTranslation();

  return (
    <ol className="flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap gap-x-3 text-label">
          <span className="text-ink-muted tabular-nums" dir="ltr">
            {shortDate(event.createdAt.slice(0, 10))}
          </span>
          <span className="text-ink">{t(`vendor.events.${event.action}`, event.action)}</span>
          <span className="text-ink-muted">{event.actor ?? t("vendor.clinic.system")}</span>
        </li>
      ))}
    </ol>
  );
}
