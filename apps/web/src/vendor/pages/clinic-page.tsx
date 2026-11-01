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
import { VendorLink } from "@web/vendor/components/vendor-link";
import { vendorPath } from "@web/vendor/lib/route";
import {
  initialSubscription,
  isReadOnly,
  lacksDependency,
  resultingModules,
} from "@web/vendor/lib/subscription";
import { VENDOR_TRIAL_DAYS } from "@web/vendor/constants";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { useClinic, useGrantSpecialty, usePlans, useSaveSubscription } from "@web/vendor/queries";

export function ClinicPage({
  id,
  navigate,
}: {
  readonly id: string;
  readonly navigate: (to: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const clinic = useClinic(id);
  const plans = usePlans();

  if (clinic.isError) {
    return <p className="text-ink-muted">{t(vendorErrorKey(clinic.error))}</p>;
  }

  if (!clinic.data || !plans.data) {
    return <div className="skeleton h-64 rounded-card" aria-hidden="true" />;
  }

  const detail = clinic.data;

  return (
    <div className="flex flex-col gap-6" data-testid="vendor-clinic">
      <div className="flex flex-col gap-1">
        <VendorLink
          to={vendorPath({ kind: "clinics" })}
          navigate={navigate}
          className="text-label text-primary-700"
        >
          {t("vendor.clinic.back")}
        </VendorLink>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline font-semibold text-ink">
            {localized(detail.name, i18n.language)}
          </h1>
          <StatusBadge status={detail.subscription?.status ?? null} />
        </div>
        <p className="text-meta text-ink-muted">
          <span dir="ltr">{detail.slug}</span> · {t("vendor.clinic.users")} {detail.users} ·{" "}
          {t("vendor.clinic.doctors")} {detail.doctors} · {t("vendor.clinic.created")}{" "}
          <span dir="ltr">{shortDate(detail.createdAt.slice(0, 10))}</span>
        </p>
        <ModuleList modules={detail.modules} />
      </div>

      {isReadOnly(detail.subscription?.status ?? null) && (
        <p role="status" className="rounded-panel bg-danger-50 p-3 text-label text-danger-700">
          {t("vendor.clinic.readOnlyNote")}
        </p>
      )}

      <SubscriptionForm key={detail.id} detail={detail} plans={plans.data.items} />
      <Specialties detail={detail} />
      <History detail={detail} />
    </div>
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
        <ol className="flex flex-col gap-2">
          {detail.events.map((event) => (
            <li key={event.id} className="flex flex-wrap gap-x-3 text-label">
              <span className="text-ink-muted tabular-nums" dir="ltr">
                {shortDate(event.createdAt.slice(0, 10))}
              </span>
              <span className="text-ink">{t(`vendor.events.${event.action}`, event.action)}</span>
              <span className="text-ink-muted">{event.actor ?? t("vendor.clinic.system")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
