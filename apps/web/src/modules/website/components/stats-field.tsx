import { SITE_FEATURES_MAX, SITE_ICONS, type SiteIcon, type SiteStat } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Select } from "@clinic/ui";
import { DraftText } from "@web/modules/website/components/draft-text";
import { RowTools } from "@web/modules/website/components/row-tools";
import { SITE_ICON_GLYPHS } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { blankText, moveItem, removeAt, replaceAt } from "@web/modules/website/lib/site-draft";

export function StatsField(): JSX.Element {
  const { t } = useTranslation();
  const { draft, update, errors, leave } = useEditor();
  const stats = draft.about.stats;
  const write = (next: SiteStat[]): void =>
    update((current) => ({ ...current, about: { ...current.about, stats: next } }));

  return (
    <div data-testid="stats-field" className="flex flex-col gap-3">
      <p className="text-value font-medium text-ink">{t("website.fields.stats")}</p>
      {stats.map((stat, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-panel border border-line bg-sunken p-3"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Select
              aria-label={t("website.feature.icon")}
              className="w-44"
              value={stat.icon}
              options={SITE_ICONS.map((icon) => ({
                value: icon,
                label: t(`website.icons.${icon}`),
                icon: <Icon name={SITE_ICON_GLYPHS[icon]} />,
              }))}
              onChange={(event) =>
                write(replaceAt(stats, index, { ...stat, icon: event.target.value as SiteIcon }))
              }
            />
            <div className="w-32" onBlur={leave(`about.stats.${index}.value`)}>
              <FormField
                label="website.fields.statValue"
                htmlFor={`stat-${index}-value`}
                error={errors[`about.stats.${index}.value`]}
              >
                <Input
                  id={`stat-${index}-value`}
                  dir="ltr"
                  maxLength={12}
                  placeholder="+5,000"
                  value={stat.value}
                  onChange={(event) =>
                    write(replaceAt(stats, index, { ...stat, value: event.target.value }))
                  }
                />
              </FormField>
            </div>
            <RowTools
              id={`stats-field-${index}`}
              index={index}
              count={stats.length}
              onMove={(delta) => write(moveItem(stats, index, delta))}
              onRemove={() => write(removeAt(stats, index))}
            />
          </div>
          <DraftText
            path={`about.stats.${index}.label`}
            label="website.fields.statLabel"
            required
          />
        </div>
      ))}
      {stats.length < SITE_FEATURES_MAX && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Icon name="plus" />}
          data-testid="stats-field-add"
          onClick={() => write([...stats, { icon: "users", value: "", label: blankText() }])}
        >
          {t("website.fields.addStat")}
        </Button>
      )}
    </div>
  );
}
