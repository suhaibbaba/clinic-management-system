import { and, eq, isNull } from "drizzle-orm";
import { CHART_TYPE, SPECIALTY_CODE, type ChartType, type SpecialtyCode } from "@clinic/shared";
import type { DatabaseExecutor } from "@api/database/database.module";
import { specialties } from "@api/database/schema";
import { ensureSystemLookups } from "@api/database/system-lookups";
import { applySpecialtyPack, type PackResult } from "@api/database/specialty-packs/specialty-pack";

export const SPECIALTIES: Readonly<Record<SpecialtyCode, { name: string; chartType: ChartType }>> =
  {
    [SPECIALTY_CODE.DENTAL]: { name: "طب الأسنان", chartType: CHART_TYPE.TOOTH_FDI },
    [SPECIALTY_CODE.ORTHOPEDIC]: { name: "جراحة العظام", chartType: CHART_TYPE.BODY_REGION },
  };

export interface GrantResult extends PackResult {
  readonly granted: boolean;
}

export async function grantSpecialty(
  db: DatabaseExecutor,
  clinicId: string,
  code: SpecialtyCode,
): Promise<GrantResult> {
  const [existing] = await db
    .select({ id: specialties.id, isActive: specialties.isActive })
    .from(specialties)
    .where(
      and(
        eq(specialties.clinicId, clinicId),
        eq(specialties.code, code),
        isNull(specialties.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(specialties).values({ clinicId, code, ...SPECIALTIES[code] });
  } else if (!existing.isActive) {
    await db
      .update(specialties)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(specialties.id, existing.id));
  }

  await ensureSystemLookups(db, clinicId);
  const pack = await applySpecialtyPack(db, clinicId, code);

  return { granted: !existing?.isActive, ...pack };
}

export async function revokeSpecialty(
  db: DatabaseExecutor,
  clinicId: string,
  code: SpecialtyCode,
): Promise<boolean> {
  const rows = await db
    .update(specialties)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(specialties.clinicId, clinicId),
        eq(specialties.code, code),
        eq(specialties.isActive, true),
        isNull(specialties.deletedAt),
      ),
    )
    .returning({ id: specialties.id });

  return rows.length > 0;
}
