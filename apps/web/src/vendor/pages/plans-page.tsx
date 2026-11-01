import { type ClinicModule, type Plan, type SavePlanInput } from "@clinic/shared";
import { Badge } from "@clinic/ui/components/badge";
import { Button } from "@clinic/ui/components/button";
import { FormField } from "@clinic/ui/components/form-field";
import { Input } from "@clinic/ui/components/input";
import { Switch } from "@clinic/ui/components/switch";
import { Table, type Column } from "@clinic/ui/components/table";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { ModuleList } from "@web/vendor/components/module-list";
import { ModulePicker } from "@web/vendor/components/module-picker";
import { VENDOR_NEW_PLAN, VENDOR_PARAM } from "@web/vendor/constants";
import type { VendorLocation } from "@web/vendor/hooks/use-location";
import { vendorPath } from "@web/vendor/lib/route";
import { lacksDependency, planInput } from "@web/vendor/lib/subscription";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { usePlans, useSavePlan } from "@web/vendor/queries";

export function PlansPage({ location }: { readonly location: VendorLocation }): JSX.Element {
  const { t } = useTranslation();
  const plans = usePlans();
  const editing = location.params.get(VENDOR_PARAM.PLAN);
  const open = (id: string | null): void =>
    location.navigate(
      `${vendorPath({ kind: "plans" })}${id === null ? "" : `?${VENDOR_PARAM.PLAN}=${id}`}`,
      { replace: true },
    );
  const items = plans.data?.items ?? [];
  const selected = items.find((plan) => plan.id === editing);

  const columns: Column<Plan>[] = [
    { key: "name", header: t("vendor.plans.name"), primary: true, render: (row) => row.name },
    {
      key: "code",
      header: t("vendor.plans.code"),
      render: (row) => <span dir="ltr">{row.code}</span>,
    },
    {
      key: "modules",
      header: t("vendor.plans.modules"),
      render: (row) => <ModuleList modules={row.modules} />,
    },
    {
      key: "limits",
      header: t("vendor.plans.maxUsers"),
      align: "numeric",
      render: (row) => row.maxUsers ?? t("vendor.plans.unlimited"),
    },
    {
      key: "clinics",
      header: t("vendor.plans.clinics"),
      align: "numeric",
      render: (row) => row.clinicCount,
    },
    {
      key: "active",
      header: t("vendor.plans.active"),
      render: (row) => (
        <Badge tone={row.isActive ? "success" : "neutral"}>
          {t(row.isActive ? "vendor.plans.active" : "vendor.plans.inactive")}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-headline font-semibold text-ink">{t("vendor.nav.plans")}</h1>
        <Button onClick={() => open(VENDOR_NEW_PLAN)} data-testid="vendor-plan-new">
          {t("vendor.plans.new")}
        </Button>
      </div>

      {(editing === VENDOR_NEW_PLAN || selected) && (
        <PlanForm key={editing} plan={selected ?? null} onDone={() => open(null)} />
      )}

      <Table
        data-testid="vendor-plans"
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        isLoading={plans.isPending}
        onRowClick={(row) => open(row.id)}
        empty={<p className="p-6 text-center text-ink-muted">{t("vendor.plans.empty")}</p>}
      />
    </>
  );
}

function PlanForm({
  plan,
  onDone,
}: {
  readonly plan: Plan | null;
  readonly onDone: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const save = useSavePlan();
  const [input, setInput] = useState<SavePlanInput>(() => planInput(plan));
  const update = (patch: Partial<SavePlanInput>): void =>
    setInput((previous) => ({ ...previous, ...patch }));
  const limit = (value: string): number | null => {
    const digits = value.replaceAll(/\D/g, "");

    return digits === "" ? null : Math.max(1, Number(digits));
  };
  const blocked =
    input.name.trim() === "" || input.code.trim() === "" || lacksDependency(input.modules);

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
      data-testid="vendor-plan-form"
    >
      <h2 className="text-section font-semibold text-ink">
        {t(plan ? "vendor.plans.edit" : "vendor.plans.new")}
      </h2>
      <div className="grid max-w-(--form-max) gap-4 sm:grid-cols-2">
        <FormField label="vendor.plans.name" htmlFor="vendor-plan-name">
          <Input
            id="vendor-plan-name"
            value={input.name}
            maxLength={80}
            onChange={(event) => update({ name: event.target.value })}
          />
        </FormField>
        <FormField label="vendor.plans.code" htmlFor="vendor-plan-code">
          <Input
            id="vendor-plan-code"
            dir="ltr"
            value={input.code}
            maxLength={40}
            onChange={(event) =>
              update({ code: event.target.value.toLowerCase().replaceAll(/[^a-z0-9-]/g, "") })
            }
          />
        </FormField>
        <FormField label="vendor.plans.maxUsers" htmlFor="vendor-plan-users">
          <Input
            id="vendor-plan-users"
            inputMode="numeric"
            placeholder={t("vendor.plans.unlimited")}
            value={input.maxUsers === null ? "" : String(input.maxUsers)}
            onChange={(event) => update({ maxUsers: limit(event.target.value) })}
          />
        </FormField>
        <FormField label="vendor.plans.maxDoctors" htmlFor="vendor-plan-doctors">
          <Input
            id="vendor-plan-doctors"
            inputMode="numeric"
            placeholder={t("vendor.plans.unlimited")}
            value={input.maxDoctors === null ? "" : String(input.maxDoctors)}
            onChange={(event) => update({ maxDoctors: limit(event.target.value) })}
          />
        </FormField>
      </div>
      <FormField label="vendor.plans.modules" htmlFor="vendor-plan-modules">
        <ModulePicker
          value={input.modules}
          onChange={(modules: ClinicModule[]) => update({ modules })}
          data-testid="vendor-plan-modules"
        />
      </FormField>
      <Switch
        checked={input.isActive}
        onCheckedChange={(isActive) => update({ isActive })}
        label={t("vendor.plans.active")}
      />
      {lacksDependency(input.modules) && (
        <p role="alert" className="text-label text-danger-700">
          {t("vendor.errors.missingModules")}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-label text-danger-700">
          {t(vendorErrorKey(save.error))}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          aria-disabled={blocked || undefined}
          isLoading={save.isPending}
          onClick={() =>
            !blocked && save.mutate({ id: plan?.id ?? null, input }, { onSuccess: onDone })
          }
          data-testid="vendor-plan-save"
        >
          {t("vendor.plans.save")}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t("vendor.plans.cancel")}
        </Button>
      </div>
    </section>
  );
}
