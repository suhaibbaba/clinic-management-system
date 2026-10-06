import { users } from "@api/database/schema";
import { sql } from "drizzle-orm";
import {
  DOCTOR_PROFILE_ROLES,
  type PersonNameInput,
  joinPersonName,
  type UserRole,
  USER_ROLE,
  type User,
} from "@clinic/shared";
import { BadRequestException } from "@nestjs/common";

export type UserRow = typeof users.$inferSelect;

export const photoCategory = (userId: string): string => `staff/${userId}`;

export const safeColumns = {
  id: users.id,
  clinicId: users.clinicId,
  nameAr: users.nameAr,
  nameEn: users.nameEn,
  firstNameAr: users.firstNameAr,
  lastNameAr: users.lastNameAr,
  firstNameEn: users.firstNameEn,
  lastNameEn: users.lastNameEn,
  phone: users.phone,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  joinedOn: users.joinedOn,
  activated: sql<boolean>`${users.passwordHash} is not null`.as("activated"),
  photoKey: users.photoKey,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export type SafeUserRow = Pick<UserRow, Exclude<keyof typeof safeColumns, "activated">> & {
  activated: boolean;
};

export function staffNameColumns(
  firstName: PersonNameInput,
  lastName: PersonNameInput,
): Pick<
  UserRow,
  "firstNameAr" | "lastNameAr" | "firstNameEn" | "lastNameEn" | "nameAr" | "nameEn"
> {
  const full = joinPersonName(firstName, lastName);

  return {
    firstNameAr: firstName.ar,
    lastNameAr: lastName.ar,
    firstNameEn: firstName.en,
    lastNameEn: lastName.en,
    nameAr: full.ar,
    nameEn: full.en,
  };
}

export function assertNotDoctorRole(role: UserRole): void {
  if (role === USER_ROLE.DOCTOR || role === USER_ROLE.VISITING_DOCTOR) {
    throw new BadRequestException("Create a doctor from the doctors screen, which makes both rows");
  }
}

export function assertRoleChange(from: UserRole, to: UserRole, hasDoctorProfile: boolean): void {
  if (!hasDoctorProfile || from === USER_ROLE.VISITING_DOCTOR) {
    assertNotDoctorRole(to);
    return;
  }

  if (!DOCTOR_PROFILE_ROLES.includes(to)) {
    throw new BadRequestException("Remove the doctor profile before giving this user that role");
  }
}

export function toUser(row: SafeUserRow, photoUrl: string | null): User {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: { ar: row.nameAr, en: row.nameEn },
    firstName: { ar: row.firstNameAr, en: row.firstNameEn },
    lastName: { ar: row.lastNameAr, en: row.lastNameEn },
    phone: row.phone,
    email: row.email,
    activated: row.activated,
    role: row.role,
    isActive: row.isActive,
    joinedOn: row.joinedOn,
    photoUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAuditSnapshot(row: SafeUserRow): Record<string, unknown> {
  return { ...toUser(row, null), photoKey: row.photoKey };
}
