import { addDays, instantFromLocal, localDate } from '@clinic/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import { clinicClosures, doctorTimeOff } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface ClosuresSeedContext {
  readonly clinicId: string;
  readonly doctorIds: readonly string[];
  readonly actorId: string;
  readonly timeZone: string;
}

// The third case sits on top of a booked appointment on purpose — the API refuses exactly that,
// which is why the seed writes it directly.
export async function seedClosures(db: Db, ctx: ClosuresSeedContext): Promise<number> {
  const [existing] = await db
    .select({ id: clinicClosures.id })
    .from(clinicClosures)
    .where(and(eq(clinicClosures.clinicId, ctx.clinicId), isNull(clinicClosures.deletedAt)))
    .limit(1);

  if (existing || ctx.doctorIds.length === 0) {
    return 0;
  }

  const today = localDate(new Date(), ctx.timeZone);
  const audit = { createdBy: ctx.actorId, updatedBy: ctx.actorId };
  const [firstDoctor] = ctx.doctorIds;

  /* istanbul ignore next -- guarded above. */
  if (!firstDoctor) {
    return 0;
  }

  await db.insert(clinicClosures).values({
    clinicId: ctx.clinicId,
    startsOn: addDays(today, 10),
    endsOn: addDays(today, 11),
    reason: 'عطلة رسمية',
    isAnnual: false,
    ...audit,
  });

  const at = (dayOffset: number, minuteOfDay: number): Date =>
    instantFromLocal(addDays(today, dayOffset), minuteOfDay, ctx.timeZone);

  await db.insert(doctorTimeOff).values([
    {
      clinicId: ctx.clinicId,
      doctorId: firstDoctor,
      // 14:00–18:00 on a working day: the morning stays bookable.
      startsAt: at(4, 14 * 60),
      endsAt: at(4, 18 * 60),
      reason: 'مؤتمر طبي',
      ...audit,
    },
    {
      clinicId: ctx.clinicId,
      doctorId: firstDoctor,
      startsAt: at(3, 9 * 60 + 30),
      endsAt: at(3, 12 * 60),
      reason: 'التزام شخصي',
      ...audit,
    },
  ]);

  return 3;
}
