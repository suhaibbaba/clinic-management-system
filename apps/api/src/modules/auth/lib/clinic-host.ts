export interface ClinicAtHost {
  readonly id: string;
  readonly googleClientId: string | null;
}

export interface SignInScope {
  readonly open: boolean;
  readonly clinicId: string | null;
}
