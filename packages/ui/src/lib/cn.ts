import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

export const FONT_SIZE_KEYS = [
  "micro",
  "meta",
  "label",
  "value",
  "nav",
  "section",
  "title",
  "display",
  "kpi",
  "field",
] as const;

export const RADIUS_KEYS = [
  "brand",
  "card",
  "chip",
  "control",
  "field",
  "nav",
  "panel",
  "pill",
] as const;

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZE_KEYS] }],
      rounded: [{ rounded: [...RADIUS_KEYS] }],
    },
  },
});

// Without the merge a caller's `w-64` and the component's `w-full` both survive and stylesheet
// order decides, so a `className` override silently does nothing.
export const cn = (...values: ClassValue[]): string => merge(clsx(values));
