import {
  DASHBOARD_CUSTOMIZE_PARAM,
  DEFAULT_DASHBOARD_LAYOUT,
  USER_ROLE,
  USER_ROLES,
  sameDashboardLayout,
  type DashboardLayout,
  type UserRole,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  EmptyState,
  Icon,
  PageHeader,
  SaveBar,
  SegmentedControl,
  useToast,
} from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { useLeaveGuard } from "@web/shared/hooks/use-leave-guard";
import { useDashboardLayouts, useSaveDashboardLayouts } from "@web/modules/dashboard/queries";
import { DashboardZones } from "@web/modules/dashboard/components/dashboard-zones";
import { WidgetFrame } from "@web/modules/dashboard/components/widget-frame";
import {
  changeWidget,
  hiddenWidgets,
  moveWidget,
  shownIn,
  standardLayoutFor,
  toggleKeyNumber,
} from "@web/modules/dashboard/lib/layout-edits";

type Drafts = Partial<Record<UserRole, DashboardLayout>>;

const isRole = (value: string | null): value is UserRole =>
  value !== null && (USER_ROLES as readonly string[]).includes(value);

export function DashboardCustomizePage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const layouts = useDashboardLayouts(true);
  const save = useSaveDashboardLayouts();
  const [drafts, setDrafts] = useState<Drafts>({});

  const requested = params.get(DASHBOARD_CUSTOMIZE_PARAM);
  const role: UserRole = isRole(requested) ? requested : USER_ROLE.ADMIN;
  const entries = layouts.data?.roles ?? [];
  const entry = entries.find((candidate) => candidate.role === role);
  const changed = entries.filter((candidate) => {
    const draft = drafts[candidate.role];

    return draft !== undefined && !sameDashboardLayout(draft, candidate.layout);
  });
  const dirty = changed.length > 0;
  const leaveGuard = useLeaveGuard(dirty, "dashboard-customize-leave");

  const pickRole = (next: UserRole): void => {
    const updated = new URLSearchParams(params);

    updated.set(DASHBOARD_CUSTOMIZE_PARAM, next);
    setParams(updated, { replace: true });
  };

  if (layouts.isPending) {
    return <Skeleton aria-hidden="true" className="h-[520px] w-full rounded-card" />;
  }

  if (!entry) {
    return (
      <EmptyState
        icon="alert"
        data-testid="dashboard-customize-error"
        title="errors.unknown"
        hint="dashboard.failed"
      />
    );
  }

  const layout = drafts[role] ?? entry.layout;
  const edit = (change: (current: DashboardLayout) => DashboardLayout): void =>
    setDrafts((current) => ({ ...current, [role]: change(current[role] ?? entry.layout) }));
  const hidden = hiddenWidgets(layout);
  const changedRoles = new Set(changed.map((candidate) => candidate.role));

  const onSave = (): void => {
    save.mutate(
      {
        layouts: changed.map((candidate) => ({
          role: candidate.role,
          layout: drafts[candidate.role] ?? candidate.layout,
        })),
      },
      {
        onSuccess: () => {
          setDrafts({});
          toast.success("dashboard.customize.saved");
        },
      },
    );
  };

  return (
    <div data-testid="dashboard-customize" className="flex flex-col gap-4">
      <PageHeader
        title="dashboard.customize.title"
        subtitle="dashboard.customize.subtitle"
        actions={
          <Button
            variant="secondary"
            data-testid="dashboard-customize-close"
            icon={<Icon name="x" />}
            onClick={() => navigate("/dashboard")}
          >
            {t("dashboard.customize.close")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<UserRole>
          data-testid="dashboard-customize-role"
          label={t("dashboard.customize.role")}
          value={role}
          onChange={pickRole}
          options={entries.map((candidate) => ({
            value: candidate.role,
            label: `${t(`roles.${candidate.role}`)}${changedRoles.has(candidate.role) ? " •" : ""}`,
          }))}
        />

        <Button
          variant="quiet"
          data-testid="dashboard-customize-reset"
          icon={<Icon name="reset" />}
          onClick={() =>
            edit((current) =>
              standardLayoutFor(current, DEFAULT_DASHBOARD_LAYOUT, entry.keyNumberOptions),
            )
          }
        >
          {t("dashboard.customize.reset")}
        </Button>
      </div>

      <div
        data-testid="dashboard-customize-add"
        className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-4 py-3"
      >
        <span className="text-label font-semibold">{t("dashboard.customize.add")}</span>
        {hidden.length === 0 && (
          <span className="text-label text-ink-muted">{t("dashboard.customize.allShown")}</span>
        )}
        {hidden.map((widget) => (
          <Button
            key={widget.id}
            variant="secondary"
            size="sm"
            data-testid={`dashboard-customize-add-${widget.id}`}
            icon={<Icon name="plus" />}
            onClick={() => edit((current) => changeWidget(current, widget.id, { visible: true }))}
          >
            {t(`dashboard.widgets.${widget.id}.title`)}
          </Button>
        ))}
      </div>

      <DashboardZones
        data-testid="dashboard-customize-zones"
        layout={layout}
        outlined
        mainLabel={t("dashboard.customize.zones.main")}
        sideLabel={t("dashboard.customize.zones.side")}
        render={(widget) => {
          const zone = shownIn(layout, widget.zone);
          const index = zone.findIndex((candidate) => candidate.id === widget.id);

          return (
            <WidgetFrame
              widget={widget}
              first={index === 0}
              last={index === zone.length - 1}
              keyOptions={entry.keyNumberOptions}
              keyNumbers={layout.keyNumbers}
              onChange={(change) => edit((current) => changeWidget(current, widget.id, change))}
              onMove={(step) => edit((current) => moveWidget(current, widget.id, step))}
              onToggleKey={(key) => edit((current) => toggleKeyNumber(current, key))}
            />
          );
        }}
      />

      <SaveBar
        data-testid="dashboard-customize-save"
        visible={dirty}
        saving={save.isPending}
        onSave={onSave}
        onDiscard={() => setDrafts({})}
      />

      {leaveGuard}
    </div>
  );
}
