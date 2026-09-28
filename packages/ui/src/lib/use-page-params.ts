import { useSearchParams } from "react-router-dom";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@ui/components/table";

export interface PageParams {
  readonly page: number;
  readonly perPage: number;
  readonly setPage: (page: number) => void;
  readonly setPerPage: (perPage: number) => void;
  readonly resetPage: () => void;
}

export function usePageParams(options: readonly number[] = PER_PAGE_OPTIONS): PageParams {
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1);
  const requested = Number.parseInt(params.get("perPage") ?? "", 10);
  const perPage = options.includes(requested) ? requested : DEFAULT_PER_PAGE;

  const write = (change: (next: URLSearchParams) => void): void => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        change(next);

        return next;
      },
      { replace: true },
    );
  };

  const putPage = (next: URLSearchParams, value: number): void => {
    if (value <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(value));
    }
  };

  return {
    page,
    perPage,
    setPage: (value) => write((next) => putPage(next, value)),
    resetPage: () => write((next) => putPage(next, 1)),
    setPerPage: (value) =>
      write((next) => {
        putPage(next, 1);

        if (value === DEFAULT_PER_PAGE) {
          next.delete("perPage");
        } else {
          next.set("perPage", String(value));
        }
      }),
  };
}
