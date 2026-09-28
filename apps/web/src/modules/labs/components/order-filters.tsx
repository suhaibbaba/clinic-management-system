import type { LabOrderView } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { SearchField, Select } from "@clinic/ui";
import { LAB_ORDER_SORT_OPTIONS } from "@web/modules/labs/constants";
import type { ListParams } from "@web/modules/labs/hooks/use-list-params";
import { sortValue } from "@web/modules/labs/lib/list-params";
import { putParam } from "@web/shared/lib/url-params";
import { useLabs } from "@web/modules/labs/queries";

export function OrderSearch({ list }: { readonly list: ListParams }): JSX.Element {
  const { t } = useTranslation();

  return (
    <SearchField
      data-testid="lab-orders-search"
      className="w-full min-w-0 sm:max-w-md sm:flex-1"
      label={t("labs.orders.search")}
      shortcut="/"
      placeholder={t("labs.orders.searchPlaceholder")}
      value={list.search}
      onChange={(event) => list.setSearch(event.target.value)}
      clearLabel={t("common.clear")}
      onClear={() => list.setSearch("")}
    />
  );
}

export function LabFilter({
  list,
  className,
}: {
  readonly list: ListParams;
  readonly className?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const labs = useLabs({ limit: 100 });

  return (
    <Select
      data-testid="lab-orders-filter-lab"
      className={className}
      aria-label={t("labs.orders.filterLab")}
      value={list.labId}
      placeholder={t("labs.orders.allLabs")}
      onChange={(event) => list.write((next) => putParam(next, "lab", event.target.value))}
      options={(labs.data?.items ?? []).map((lab) => ({ value: lab.id, label: lab.name }))}
    />
  );
}

export function SortSelect({
  view,
  list,
  className,
}: {
  readonly view: LabOrderView;
  readonly list: ListParams;
  readonly className?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const options = LAB_ORDER_SORT_OPTIONS[view];

  return (
    <Select
      data-testid="lab-orders-sort"
      className={className}
      aria-label={t("labs.orders.sortBy")}
      value={sortValue(list.sort)}
      onChange={(event) => {
        const chosen = options.find((option) => sortValue(option) === event.target.value);

        list.write((next) => {
          if (!chosen || chosen === options[0]) {
            next.delete("sort");
            next.delete("dir");
          } else {
            next.set("sort", chosen.sort);
            next.set("dir", chosen.dir);
          }
        });
      }}
      options={options.map((option) => ({ value: sortValue(option), label: t(option.label) }))}
    />
  );
}
