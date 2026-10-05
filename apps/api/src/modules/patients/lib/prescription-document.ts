import { type PrescriptionItem } from "@clinic/shared";
import { type DocumentStrings } from "@api/modules/billing/pdf/document-strings";
import { type Cell } from "@api/modules/billing/pdf/pdf-builder";

type PrescriptionStrings = DocumentStrings["prescription"];

export function documentDays(days: PrescriptionStrings["days"], count: number): string {
  const template =
    count === 1
      ? days.one
      : count === 2
        ? days.two
        : count % 100 >= 3 && count % 100 <= 10
          ? days.few
          : days.many;

  return template.replace("{count}", String(count));
}

export function prescriptionRow(
  item: PrescriptionItem,
  index: number,
  text: PrescriptionStrings,
): (string | Cell)[] {
  const amount = (value: number | null | undefined, fallback: string | null | undefined): string =>
    value == null ? (fallback ?? "") : String(value);

  return [
    String(index + 1),
    {
      text: item.drug,
      sub: item.note ? `${text.instructions}: ${item.note}` : undefined,
    },
    amount(item.perDose, item.dose),
    amount(item.timesPerDay, item.frequency),
    item.days == null ? (item.duration ?? "") : documentDays(text.days, item.days),
  ];
}
