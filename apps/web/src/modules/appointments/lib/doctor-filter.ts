import type { Doctor } from "@clinic/shared";

export function ownDoctorFirst(
  doctors: readonly Doctor[],
  userId: string | undefined,
): readonly Doctor[] {
  const own = doctors.find((doctor) => doctor.userId === userId);

  return own ? [own, ...doctors.filter((doctor) => doctor !== own)] : doctors;
}
