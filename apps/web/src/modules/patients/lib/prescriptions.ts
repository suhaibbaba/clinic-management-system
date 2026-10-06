import { regimenShorthand, type PrescriptionItem } from "@clinic/shared";

const LEFT_TO_RIGHT_ISOLATE = "⁦";
const POP_DIRECTIONAL_ISOLATE = "⁩";

export function describeItem(item: PrescriptionItem): string {
  const shorthand = regimenShorthand(item);

  return [
    shorthand && `${LEFT_TO_RIGHT_ISOLATE}${shorthand}${POP_DIRECTIONAL_ISOLATE}`,
    item.dose,
    item.frequency,
    item.duration,
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface DrugSuggestion {
  readonly key: string;
  readonly label: string;
}

export function isKnownDrug(drugs: readonly DrugSuggestion[], typed: string): boolean {
  const query = typed.trim().toLowerCase();

  return drugs.some((drug) => drug.label.toLowerCase() === query);
}

export function drugSuggestions(
  drugs: readonly DrugSuggestion[],
  typed: string,
  limit = 6,
): DrugSuggestion[] {
  if (isKnownDrug(drugs, typed)) {
    return [];
  }

  const query = typed.trim().toLowerCase();

  return drugs.filter((drug) => drug.label.toLowerCase().includes(query)).slice(0, limit);
}
