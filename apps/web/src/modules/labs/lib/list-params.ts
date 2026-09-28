import type { LabOrderSortOption } from "@web/modules/labs/constants";

export const sortValue = (option: Pick<LabOrderSortOption, "sort" | "dir">): string =>
  `${option.sort}-${option.dir}`;
