import { doctors, users, specialties } from "@api/database/schema";
import {
  type WeeklySchedule,
  type UserRole,
  type ChartType,
  type Doctor,
  USER_ROLE,
} from "@clinic/shared";

export type DoctorRow = typeof doctors.$inferSelect;

export const doctorColumns = {
  id: doctors.id,
  clinicId: doctors.clinicId,
  userId: doctors.userId,
  specialtyId: doctors.specialtyId,
  weeklySchedule: doctors.weeklySchedule,
  defaultAppointmentDurationMinutes: doctors.defaultAppointmentDurationMinutes,
  createdAt: doctors.createdAt,
  updatedAt: doctors.updatedAt,
  userNameAr: users.nameAr,
  userNameEn: users.nameEn,
  userPhone: users.phone,
  userEmail: users.email,
  userIsActive: users.isActive,
  userPhotoKey: users.photoKey,
  userRole: users.role,
  specialtyCode: specialties.code,
  specialtyName: specialties.name,
  specialtyChartType: specialties.chartType,
};

export interface DoctorJoinedRow {
  id: string;
  clinicId: string;
  userId: string;
  specialtyId: string;
  weeklySchedule: WeeklySchedule;
  defaultAppointmentDurationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
  userNameAr: string;
  userNameEn: string;
  userPhone: string;
  userEmail: string | null;
  userIsActive: boolean;
  userPhotoKey: string | null;
  userRole: UserRole;
  specialtyCode: string;
  specialtyName: string;
  specialtyChartType: ChartType;
}

export function toDoctor(row: DoctorJoinedRow, photoUrl: string | null): Doctor {
  return {
    id: row.id,
    clinicId: row.clinicId,
    userId: row.userId,
    specialtyId: row.specialtyId,
    weeklySchedule: row.weeklySchedule,
    defaultAppointmentDurationMinutes: row.defaultAppointmentDurationMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: {
      id: row.userId,
      name: { ar: row.userNameAr, en: row.userNameEn },
      phone: row.userPhone,
      email: row.userEmail,
      isActive: row.userIsActive,
      photoUrl,
    },
    specialty: {
      id: row.specialtyId,
      code: row.specialtyCode,
      name: row.specialtyName,
      chartType: row.specialtyChartType,
    },
    isVisiting: row.userRole === USER_ROLE.VISITING_DOCTOR,
  };
}
