import type { LabOrderSortOption } from "@web/modules/labs/constants";

export const sortValue = (option: Pick<LabOrderSortOption, "sort" | "dir">): string =>
  `${option.sort}-${option.dir}`;

export const putParam = (next: URLSearchParams, key: string, value: string): void => {
  if (value === "") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
};
