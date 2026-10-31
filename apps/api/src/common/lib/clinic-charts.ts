import { and, eq, isNull } from "drizzle-orm";
import type { ChartType } from "@clinic/shared";
import type { DatabaseExecutor } from "@api/database/database.module";
import { specialties } from "@api/database/schema";

export async function clinicChartTypes(
  db: DatabaseExecutor,
  clinicId: string,
): Promise<ChartType[]> {
  const rows = await db
    .selectDistinct({ chartType: specialties.chartType })
    .from(specialties)
    .where(
      and(
        eq(specialties.clinicId, clinicId),
        eq(specialties.isActive, true),
        isNull(specialties.deletedAt),
      ),
    );

  return rows.map((row) => row.chartType);
}
