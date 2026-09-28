import { clinicClosures } from "@api/database/schema";
import { BadRequestException } from "@nestjs/common";

export type ClosureRow = typeof clinicClosures.$inferSelect;

export function assertAnnualFitsOneYear(startsOn: string, endsOn: string, isAnnual: boolean): void {
  if (isAnnual && startsOn.slice(0, 4) !== endsOn.slice(0, 4)) {
    throw new BadRequestException("An annual closure must start and end in the same year");
  }
}
