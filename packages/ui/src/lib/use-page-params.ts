import { useSearchParams } from 'react-router-dom';

import { PER_PAGE_OPTIONS } from '@ui/components/table';

export interface PageParams {
  readonly page: number;
  readonly perPage: number;
  readonly setPage: (page: number) => void;
  readonly setPerPage: (perPage: number) => void;
  /** What a changed filter calls: a narrower list has no page seven. */
  readonly resetPage: () => void;
}

/**
 * The page and its size, in the address. A row somebody found on page three is a row they can send
 * to a colleague, and a reader who wants fifty at a time should not have to say so twice.
 */
export function usePageParams(
  defaultPerPage: number,
  options: readonly number[] = PER_PAGE_OPTIONS,
): PageParams {
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number.parseInt(params.get('page') ?? '', 10) || 1);
  const requested = Number.parseInt(params.get('perPage') ?? '', 10);
  const perPage = options.includes(requested) ? requested : defaultPerPage;

  // Every write goes through the updater form, never a captured copy: a filter that sets its own
  // param and then resets the page would otherwise put the first write back.
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

  // The default is absent from the address rather than spelled out in it, like every other param in
  // the app: a bare URL means the first page.
  const putPage = (next: URLSearchParams, value: number): void => {
    if (value <= 1) {
      next.delete('page');
    } else {
      next.set('page', String(value));
    }
  };

  return {
    page,
    perPage,
    setPage: (value) => write((next) => putPage(next, value)),
    resetPage: () => write((next) => putPage(next, 1)),
    setPerPage: (value) =>
      write((next) => {
        // Page seven of ten-row pages is page two of fifty-row ones; rather than guess, go back.
        putPage(next, 1);

        if (value === defaultPerPage) {
          next.delete('perPage');
        } else {
          next.set('perPage', String(value));
        }
      }),
  };
}
