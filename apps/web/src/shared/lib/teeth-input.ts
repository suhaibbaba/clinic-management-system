import { fdiArchRange, isFdiTooth } from "@clinic/shared";

const RANGE = /^(\d{2})\s*[-–]\s*(\d{2})$/;

export function parseTeethInput(raw: string): number[] | null {
  const text = raw.trim();
  const range = RANGE.exec(text);

  if (range) {
    return fdiArchRange(Number(range[1]), Number(range[2]));
  }

  const tooth = Number(text);

  return text !== "" && Number.isInteger(tooth) && isFdiTooth(tooth) ? [tooth] : null;
}
