import { subtractMoney, type Money, type OwnSettlementLine } from "@clinic/shared";

export type ShareStepKey = "tax" | "overhead" | "materials";

export interface ShareStep {
  readonly key: ShareStepKey;
  readonly amount: Money;
}

export interface ShareSteps {
  readonly beforeNet: readonly ShareStep[];
  readonly net: Money;
  readonly sharePercent: number;
  readonly workPercent: number;
  readonly afterShare: readonly ShareStep[];
}

type StepSource = Pick<OwnSettlementLine, "revenue" | "workPercent" | "breakdown">;

interface NetSource {
  readonly revenue: Money;
  readonly tax: Money;
  readonly overhead: Money;
  readonly net: Money;
}

const present = (steps: readonly ShareStep[]): ShareStep[] =>
  steps.filter((step) => Number(step.amount) !== 0);

export function netSteps(source: NetSource): ShareStep[] {
  return present([
    { key: "tax", amount: source.tax },
    { key: "overhead", amount: source.overhead },
    {
      key: "materials",
      amount: subtractMoney(
        subtractMoney(subtractMoney(source.revenue, source.tax), source.overhead),
        source.net,
      ),
    },
  ]);
}

export function shareSteps(line: StepSource): ShareSteps | null {
  const breakdown = line.breakdown;

  if (!breakdown) {
    return null;
  }

  const beforeNet = netSteps({ revenue: line.revenue, ...breakdown });
  const materialsOnDoctor = !beforeNet.some((step) => step.key === "materials");

  return {
    beforeNet,
    net: breakdown.net,
    sharePercent: breakdown.sharePercent,
    workPercent: line.workPercent,
    afterShare: materialsOnDoctor
      ? present([{ key: "materials", amount: breakdown.materialCost }])
      : [],
  };
}
