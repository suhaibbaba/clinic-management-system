import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounced } from "@web/hooks/shared/use-debounced";

export interface InventoryFilterChange {
  readonly category?: string;
  readonly low?: boolean;
  readonly expiring?: boolean;
}

export interface InventoryFilters {
  readonly search: string;
  readonly debouncedSearch: string;
  readonly category: string;
  readonly low: boolean;
  readonly expiring: boolean;
  readonly setSearch: (value: string) => void;
  readonly setFilters: (change: InventoryFilterChange) => void;
}

export function useInventoryFilters(resetPage: () => void): InventoryFilters {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const debounced = useDebounced(search);
  const lastSearch = useRef(debounced);

  useEffect(() => {
    if (lastSearch.current !== debounced) {
      lastSearch.current = debounced;
      resetPage();
    }
  }, [debounced]);

  return {
    search,
    debouncedSearch: debounced.trim(),
    category: params.get("category") ?? "",
    low: params.get("low") === "1",
    expiring: params.get("expiring") === "1",
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
    setFilters: (change) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(change)) {
            if (value === undefined) {
              continue;
            }
            if (value === "" || value === false) {
              next.delete(key);
            } else {
              next.set(key, value === true ? "1" : value);
            }
          }
          next.delete("page");

          return next;
        },
        { replace: true },
      ),
  };
}
