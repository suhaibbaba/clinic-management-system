import {
  type ClinicModule,
  type LocalizedText,
  type Subscription,
  type SubscriptionStatus,
} from "@clinic/shared";
import { clinics, plans, subscriptions } from "@api/database/schema";

export const SUMMARY_COLUMNS = {
  id: clinics.id,
  slug: clinics.slug,
  name: clinics.name,
  domain: clinics.siteDomain,
  modules: clinics.modules,
  createdAt: clinics.createdAt,
  planId: subscriptions.planId,
  planName: plans.name,
  addOnModules: subscriptions.addOnModules,
  status: subscriptions.status,
  startsOn: subscriptions.startsOn,
  endsOn: subscriptions.endsOn,
  graceDays: subscriptions.graceDays,
  notes: subscriptions.notes,
  subscriptionUpdatedAt: subscriptions.updatedAt,
};

export interface SummaryRow {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly domain: string | null;
  readonly modules: ClinicModule[];
  readonly createdAt: Date;
  readonly planId: string | null;
  readonly planName: string | null;
  readonly addOnModules: ClinicModule[] | null;
  readonly status: SubscriptionStatus | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly graceDays: number | null;
  readonly notes: string | null;
  readonly subscriptionUpdatedAt: Date | null;
}

export function subscriptionOf(row: SummaryRow): Subscription | null {
  if (
    row.planId === null ||
    row.status === null ||
    row.startsOn === null ||
    row.subscriptionUpdatedAt === null
  ) {
    return null;
  }

  return {
    planId: row.planId,
    planName: row.planName ?? "",
    addOnModules: row.addOnModules ?? [],
    status: row.status,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    graceDays: row.graceDays ?? 0,
    notes: row.notes,
    updatedAt: row.subscriptionUpdatedAt.toISOString(),
  };
}
