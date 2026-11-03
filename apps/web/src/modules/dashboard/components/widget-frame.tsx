import {
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDGET,
  DASHBOARD_WIDTHS,
  DASHBOARD_ZONE,
  type DashboardKeyNumber,
  type DashboardWidgetPlacement,
  type DashboardWidth,
  type DashboardZone,
} from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, SegmentedControl } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import type { WidgetChange } from "@web/modules/dashboard/lib/layout-edits";
import { DASHBOARD_KEY_NUMBER_LABEL } from "@web/modules/dashboard/constants";

export interface WidgetFrameProps {
  readonly widget: DashboardWidgetPlacement;
  readonly first: boolean;
  readonly last: boolean;
  readonly keyOptions: readonly DashboardKeyNumber[];
  readonly keyNumbers: readonly DashboardKeyNumber[];
  readonly onChange: (change: WidgetChange) => void;
  readonly onMove: (step: -1 | 1) => void;
  readonly onToggleKey: (key: DashboardKeyNumber) => void;
}

export function WidgetFrame({
  widget,
  first,
  last,
  keyOptions,
  keyNumbers,
  onChange,
  onMove,
  onToggleKey,
}: WidgetFrameProps): JSX.Element {
  const { t } = useTranslation();
  const testId = `dashboard-frame-${widget.id}`;
  const zones = DASHBOARD_WIDGETS[widget.id].zones;

  return (
    <section
      data-testid={testId}
      aria-label={t(`dashboard.widgets.${widget.id}.title`)}
      className="flex flex-col gap-3 rounded-card border-2 border-dashed border-primary-600/30 bg-surface p-3.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="grip" className="size-4 shrink-0 text-ink-muted" />
        <h2 className="min-w-0 flex-1 text-label font-semibold">
          {t(`dashboard.widgets.${widget.id}.title`)}
        </h2>

        {zones.length > 1 && (
          <SegmentedControl<DashboardZone>
            data-testid={`${testId}-zone`}
            label={t("dashboard.customize.zone")}
            value={widget.zone}
            onChange={(zone) => onChange({ zone })}
            options={zones.map((zone) => ({
              value: zone,
              label: t(`dashboard.customize.zones.${zone}`),
            }))}
          />
        )}

        {widget.zone === DASHBOARD_ZONE.MAIN && (
          <SegmentedControl<DashboardWidth>
            data-testid={`${testId}-width`}
            label={t("dashboard.customize.width")}
            value={widget.width}
            onChange={(width) => onChange({ width })}
            options={DASHBOARD_WIDTHS.map((width) => ({
              value: width,
              label: t(`dashboard.customize.widths.${width}`),
            }))}
          />
        )}

        <Button
          variant="secondary"
          size="sm"
          data-testid={`${testId}-earlier`}
          aria-label={t("dashboard.customize.moveEarlier")}
          aria-disabled={first}
          icon={<Icon name="arrow-up" />}
          onClick={() => !first && onMove(-1)}
        />
        <Button
          variant="secondary"
          size="sm"
          data-testid={`${testId}-later`}
          aria-label={t("dashboard.customize.moveLater")}
          aria-disabled={last}
          icon={<Icon name="arrow-down" />}
          onClick={() => !last && onMove(1)}
        />
        <Button
          variant="quiet"
          size="sm"
          data-testid={`${testId}-hide`}
          aria-label={t("dashboard.customize.hide")}
          icon={<Icon name="eye-off" />}
          onClick={() => onChange({ visible: false })}
        />
      </div>

      {widget.id === DASHBOARD_WIDGET.KEY_NUMBERS ? (
        <div className="flex flex-col gap-2">
          <p className="text-label text-ink-muted">{t("dashboard.customize.keyNumbers")}</p>
          <div className="flex flex-wrap gap-2">
            {keyOptions.map((key) => {
              const on = keyNumbers.includes(key);

              return (
                <Button
                  key={key}
                  variant={on ? "ghost" : "secondary"}
                  size="sm"
                  data-testid={`${testId}-key-${key}`}
                  aria-pressed={on}
                  icon={<Icon name={on ? "check" : "plus"} />}
                  onClick={() => onToggleKey(key)}
                >
                  {t(DASHBOARD_KEY_NUMBER_LABEL[key] ?? key)}
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className={cn("rounded-panel bg-inset px-3 py-4 text-label text-ink-muted")}>
          {t(`dashboard.widgets.${widget.id}.description`)}
        </p>
      )}
    </section>
  );
}
