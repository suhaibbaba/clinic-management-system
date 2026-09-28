import type { LabOrderView } from "@clinic/shared";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { LAB_ORDER_SORT_OPTIONS, type LabOrderSortOption } from "@web/modules/labs/constants";
import { useDebounced } from "@web/shared/hooks/use-debounced";
import { sortValue } from "@web/modules/labs/lib/list-params";

export interface ListParams {
  readonly search: string;
  readonly debouncedSearch: string;
  readonly labId: string;
  readonly status: string;
  readonly sort: LabOrderSortOption;
  readonly isDefaultSort: boolean;
  readonly setSearch: (value: string) => void;
  readonly write: (change: (next: URLSearchParams) => void) => void;
}

export function useListParams(view: LabOrderView, resetPage: () => void): ListParams {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const labId = params.get("lab") ?? "";
  const status = params.get("status") ?? "";
  const options = LAB_ORDER_SORT_OPTIONS[view];
  const fallback = options[0] as LabOrderSortOption;
  const requested = `${params.get("sort") ?? ""}-${params.get("dir") ?? ""}`;
  const sort = options.find((option) => sortValue(option) === requested) ?? fallback;

  const debouncedSearch = useDebounced(search);
  const lastSearch = useRef(debouncedSearch);

  useEffect(() => {
    if (lastSearch.current !== debouncedSearch) {
      lastSearch.current = debouncedSearch;
      resetPage();
    }
  }, [debouncedSearch]);

  const write = (change: (next: URLSearchParams) => void): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        change(next);
        next.delete("page");

        return next;
      },
      { replace: true },
    );

  return {
    search,
    debouncedSearch: debouncedSearch.trim(),
    labId,
    status,
    sort,
    isDefaultSort: sort === fallback,
    setSearch: (value) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          if (value === "") {
            next.delete("q");
          } else {
            next.set("q", value);
          }

          return next;
        },
        { replace: true },
      ),
    write,
  };
}
