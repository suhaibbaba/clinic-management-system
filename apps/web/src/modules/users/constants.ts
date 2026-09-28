export const USERS_VIEW = "users";

export const DOCTORS_VIEW = "doctors";

export const STAFF_NAME_FIELDS = [
  { path: "firstName.ar", label: "users.firstNameAr", placeholder: "firstNameAr", ltr: false },
  { path: "lastName.ar", label: "users.lastNameAr", placeholder: "lastNameAr", ltr: false },
  { path: "firstName.en", label: "users.firstNameEn", placeholder: "firstNameEn", ltr: true },
  { path: "lastName.en", label: "users.lastNameEn", placeholder: "lastNameEn", ltr: true },
] as const;
