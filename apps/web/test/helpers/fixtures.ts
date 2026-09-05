import { USER_ROLE, type AuthenticatedUserProfile, type User } from '@clinic/shared';

export const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

export function makeProfile(
  overrides: Partial<AuthenticatedUserProfile> = {},
): AuthenticatedUserProfile {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    clinicId: CLINIC_ID,
    name: 'مدير العيادة',
    phone: '+963100000001',
    email: 'admin@clinic.local',
    role: USER_ROLE.ADMIN,
    isActive: true,
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    clinicId: CLINIC_ID,
    name: 'ليلى حداد',
    phone: '+963100000002',
    email: 'layla@clinic.local',
    role: USER_ROLE.DOCTOR,
    isActive: true,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}

export function paginated<TItem>(items: TItem[]) {
  return { items, page: 1, limit: 10, total: items.length, totalPages: 1 };
}
