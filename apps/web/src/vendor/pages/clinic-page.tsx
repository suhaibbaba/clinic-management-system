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
import { Switch } from "@clinic/ui/components/switch";
import { useConfirm } from "@clinic/ui/components/confirm-dialog";
import { SaveBar } from "@clinic/ui/components/save-bar";
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
  useRevokeSpecialty,
  useSaveModules,
  usePlans,
  useSaveAppDomain,
  useSaveDomain,
  useSaveSubscription,
} from "@web/vendor/queries";
import { clinicAddresses, parseDomain, parseHost } from "@web/vendor/lib/domain";
import { KeysPanel } from "@web/vendor/components/keys-panel";

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
    VENDOR_CLINIC_TABS.find((entry) => entry === params.get(VENDOR_PARAM.TAB)) ?? "modules";
  const openTab = (next: ClinicTab): void =>
    navigate(
      `${vendorPath({ kind: "clinic", id })}${next === "modules" ? "" : `?${VENDOR_PARAM.TAB}=${next}`}`,
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
  const addresses = clinicAddresses(detail.domain, detail.appDomain);

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
              {addresses.website && (
                <a
                  href={addresses.website}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                  className="text-primary-700 underline"
                >
                  {detail.domain}
                </a>
              )}
              {addresses.dashboard && (
                <a
                  href={addresses.dashboard}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                  className="text-primary-700 underline"
                >
                  {detail.appDomain}
                </a>
              )}
              {!addresses.website && !addresses.dashboard && <span dir="ltr">{detail.slug}</span>}
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
        <dl className="grid grid-cols-3 gap-3">
          <Stat label={t("vendor.clinic.users")} value={String(detail.users)} />
          <Stat label={t("vendor.clinic.doctors")} value={String(detail.doctors)} />
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
      {tab === "modules" && (
        <ModulesPanel key={`modules-${detail.id}`} detail={detail} plans={plans.data.items} />
      )}
      {tab === "domain" && (
        <>
          <DomainForm key={`domain-${detail.id}`} detail={detail} />
          <AppDomainForm key={`app-domain-${detail.id}`} detail={detail} />
        </>
      )}
      {tab === "keys" && <KeysPanel key={JSON.stringify(detail.keys)} detail={detail} />}
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
      </div>
      <SaveBar
        data-testid="vendor-domain-bar"
        visible={!unchanged && text.trim() !== (detail.domain ?? "")}
        saving={save.isPending}
        invalid={invalid}
        onSave={() => !invalid && !unchanged && save.mutate(parsed)}
        onDiscard={() => setText(detail.domain ?? "")}
      />

      {invalid && (
        <p role="alert" className="text-label text-danger-700" data-testid="vendor-domain-invalid">
          {t("vendor.clinic.domainInvalid")}
        </p>
      )}

      {detail.domain ? (
        <a
          href={`https://${detail.domain}`}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
          className="self-start text-label text-primary-700 underline"
          data-testid="vendor-domain-address"
        >
          {`https://${detail.domain}`}
        </a>
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

function AppDomainForm({ detail }: { readonly detail: VendorClinicDetail }): JSX.Element {
  const { t } = useTranslation();
  const save = useSaveAppDomain(detail.id);
  const [text, setText] = useState(detail.appDomain ?? "");
  const parsed = parseHost(text);
  const invalid = parsed === undefined;
  const unchanged = parsed === detail.appDomain;

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-app-domain"
    >
      <h2 className="text-section font-semibold text-ink">{t("vendor.clinic.appDomain")}</h2>
      <div className="flex max-w-(--form-max) flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <FormField
            label="vendor.clinic.appDomain"
            htmlFor="vendor-app-domain-input"
            hint="vendor.clinic.appDomainHint"
          >
            <Input
              id="vendor-app-domain-input"
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("vendor.clinic.appDomainPlaceholder")}
              value={text}
              hasError={invalid}
              onChange={(event) => setText(event.target.value)}
              data-testid="vendor-app-domain-input"
            />
          </FormField>
        </div>
      </div>
      <SaveBar
        data-testid="vendor-app-domain-bar"
        visible={!unchanged && text.trim() !== (detail.appDomain ?? "")}
        saving={save.isPending}
        invalid={invalid}
        onSave={() => !invalid && !unchanged && save.mutate(parsed)}
        onDiscard={() => setText(detail.appDomain ?? "")}
      />

      {invalid && (
        <p
          role="alert"
          className="text-label text-danger-700"
          data-testid="vendor-app-domain-invalid"
        >
          {t("vendor.clinic.domainInvalid")}
        </p>
      )}

      {detail.appDomain ? (
        <a
          href={`https://${detail.appDomain}`}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
          className="self-start text-label text-primary-700 underline"
          data-testid="vendor-app-domain-address"
        >
          {`https://${detail.appDomain}`}
        </a>
      ) : (
        <p className="text-meta text-ink-muted">{t("vendor.clinic.noAppDomain")}</p>
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
  const [baseline, setBaseline] = useState(() => initialSubscription(detail, plans));
  const [input, setInput] = useState(baseline);
  const dirty = JSON.stringify(input) !== JSON.stringify(baseline) || detail.subscription === null;
  const blocked = false;
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

      <SaveBar
        data-testid="vendor-subscription-bar"
        visible={dirty}
        saving={save.isPending}
        invalid={blocked}
        onSave={() => !blocked && save.mutate(input, { onSuccess: () => setBaseline(input) })}
        onDiscard={() => setInput(baseline)}
      />
    </section>
  );
}

function ModulesPanel({
  detail,
  plans,
}: {
  readonly detail: VendorClinicDetail;
  readonly plans: readonly Plan[];
}): JSX.Element {
  const { t } = useTranslation();
  const save = useSaveModules(detail.id);
  const plan = plans.find((entry) => entry.id === detail.subscription?.planId);
  const planModules: readonly ClinicModule[] = plan?.modules ?? [];
  const [extra, setExtra] = useState<ClinicModule[]>(() =>
    detail.modules.filter((module) => !planModules.includes(module)),
  );
  const modules = resultingModules(planModules, extra);
  const unchanged = modules.join() === detail.modules.join();
  const blocked = lacksDependency(modules) || unchanged;

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-modules"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-section font-semibold text-ink">{t("vendor.clinic.tabs.modules")}</h2>
        <p className="text-meta text-ink-muted">{t("vendor.clinic.modulesByHand")}</p>
      </div>
      <ModulePicker
        value={extra}
        included={planModules}
        onChange={setExtra}
        data-testid="vendor-module-switches"
      />
      {lacksDependency(modules) && (
        <p role="alert" className="text-label text-danger-700">
          {t("vendor.errors.missingModules")}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-label text-danger-700">
          {t(vendorErrorKey(save.error))}
        </p>
      )}
      {save.isSuccess && unchanged && (
        <p role="status" className="text-label text-success-700">
          {t("vendor.clinic.modulesSaved")}
        </p>
      )}
      <SaveBar
        data-testid="vendor-modules-bar"
        visible={!unchanged}
        saving={save.isPending}
        invalid={lacksDependency(modules)}
        onSave={() => !blocked && save.mutate(modules)}
        onDiscard={() => setExtra(detail.modules.filter((module) => !planModules.includes(module)))}
      />
    </section>
  );
}

function Specialties({ detail }: { readonly detail: VendorClinicDetail }): JSX.Element {
  const { t, i18n } = useTranslation();
  const grant = useGrantSpecialty(detail.id);
  const revoke = useRevokeSpecialty(detail.id);
  const { confirm, dialog } = useConfirm("vendor-specialty-confirm");
  const [lastWarning, setLastWarning] = useState(false);
  const name = localized(detail.name, i18n.language);

  const toggle = (code: SpecialtyCode, on: boolean): void => {
    setLastWarning(false);

    if (on) {
      grant.mutate(code);
      return;
    }

    if (detail.specialties.length <= 1) {
      setLastWarning(true);
      return;
    }

    confirm({
      title: "vendor.clinic.revokeTitle",
      titleValues: { specialty: t(`vendor.specialtyNames.${code}`), name },
      tone: "danger",
      confirmLabel: "vendor.clinic.revoke",
      consequences: [t("vendor.clinic.revokeBody")],
      onConfirm: () => revoke.mutateAsync(code),
    });
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-specialties"
    >
      <h2 className="text-section font-semibold text-ink">{t("vendor.clinic.specialties")}</h2>
      <ul className="flex flex-col gap-3">
        {Object.values(SPECIALTY_CODE).map((code: SpecialtyCode) => (
          <li key={code} className="flex items-center justify-between gap-3">
            <Switch
              checked={detail.specialties.includes(code)}
              onCheckedChange={(on) => toggle(code, on)}
              label={t(`vendor.specialtyNames.${code}`)}
              data-testid={`vendor-specialty-${code}`}
            />
          </li>
        ))}
      </ul>
      {lastWarning && (
        <p role="alert" className="text-label text-danger-700">
          {t("vendor.errors.lastSpecialty")}
        </p>
      )}
      {(grant.isError || revoke.isError) && (
        <p role="alert" className="text-label text-danger-700">
          {t(vendorErrorKey(grant.error ?? revoke.error))}
        </p>
      )}
      {dialog}
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
