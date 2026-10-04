import type { LookupOption, ProcedureCatalogItem } from "@clinic/shared";

export function procedureOutcomes(states: readonly LookupOption[]): LookupOption[] {
  return states.filter((state) => {
    const behaviour = (state.meta as { chartBehavior?: { stateOnly?: boolean } } | null)
      ?.chartBehavior;

    return behaviour?.stateOnly !== true;
  });
}

export function searchPriceList(
  items: readonly ProcedureCatalogItem[],
  search: string,
): ProcedureCatalogItem[] {
  const needle = search.trim().toLowerCase();

  if (needle === "") {
    return [...items];
  }

  return items.filter(
    (item) => item.name.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle),
  );
}

export const wholePrice = (amount: string): string => amount.replace(/\.0+$/, "");
