import { usePageParams, type PageParams } from "@clinic/ui";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounced } from "@web/shared/hooks/use-debounced";

export interface ShareTableParams<TFilter extends string> extends PageParams {
  readonly search: string;
  readonly query: string;
  readonly filter: TFilter | null;
  readonly setSearch: (search: string) => void;
  readonly setFilter: (filter: TFilter | null) => void;
}

export function useShareTableParams<TFilter extends string>(
  scope: string,
  filters: readonly TFilter[],
): ShareTableParams<TFilter> {
  const [params, setParams] = useSearchParams();
  const paging = usePageParams(undefined, scope);
  const searchKey = `${scope}Search`;
  const filterKey = `${scope}Filter`;
  const query = params.get(searchKey) ?? "";
  const requested = params.get(filterKey);
  const [search, setSearch] = useState(query);
  const settled = useDebounced(search);

  const write = (key: string, value: string | null): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === null || value.trim() === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        next.delete(`${scope}Page`);

        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if (settled.trim() !== query.trim()) {
      write(searchKey, settled);
    }
  }, [settled]);

  return {
    ...paging,
    search,
    query,
    filter: filters.find((value) => value === requested) ?? null,
    setSearch,
    setFilter: (filter) => write(filterKey, filter),
  };
}
