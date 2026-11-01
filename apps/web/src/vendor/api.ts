import type {
  CreateClinicInput,
  CreatedClinic,
  GrantSpecialtyInput,
  Paginated,
  Plan,
  SaveClinicDomainInput,
  SaveClinicModulesInput,
  SpecialtyCode,
  SavePlanInput,
  SaveSubscriptionInput,
  VendorClinicDetail,
  VendorClinicSummary,
  VendorClinicsQuery,
  VendorLoginInput,
  VendorOverview,
  VendorProfile,
} from "@clinic/shared";
import { VENDOR_API } from "@web/vendor/constants";
import { VendorApiError } from "@web/vendor/lib/vendor-api-error";

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${VENDOR_API}${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      { message?: unknown } | undefined;

    throw new VendorApiError(
      response.status,
      typeof payload?.message === "string" ? payload.message : undefined,
    );
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const text = search.toString();

  return text ? `?${text}` : "";
};

export const vendorApi = {
  session: () => request<VendorProfile>("GET", "/session"),
  signIn: (input: VendorLoginInput) => request<VendorProfile>("POST", "/session", input),
  signOut: () => request<void>("DELETE", "/session"),
  overview: () => request<VendorOverview>("GET", "/overview"),
  clinics: (params: Partial<VendorClinicsQuery>) =>
    request<Paginated<VendorClinicSummary>>("GET", `/clinics${query(params)}`),
  clinic: (id: string) => request<VendorClinicDetail>("GET", `/clinics/${id}`),
  createClinic: (input: CreateClinicInput) => request<CreatedClinic>("POST", "/clinics", input),
  removeClinic: (id: string) => request<void>("DELETE", `/clinics/${id}`),
  restoreClinic: (id: string) => request<void>("POST", `/clinics/${id}/restore`),
  saveSubscription: (id: string, input: SaveSubscriptionInput) =>
    request<void>("PUT", `/clinics/${id}/subscription`, input),
  saveDomain: (id: string, input: SaveClinicDomainInput) =>
    request<void>("PUT", `/clinics/${id}/domain`, input),
  saveModules: (id: string, input: SaveClinicModulesInput) =>
    request<void>("PUT", `/clinics/${id}/modules`, input),
  revokeSpecialty: (id: string, code: SpecialtyCode) =>
    request<void>("DELETE", `/clinics/${id}/specialties/${code}`),
  grantSpecialty: (id: string, input: GrantSpecialtyInput) =>
    request<void>("POST", `/clinics/${id}/specialties`, input),
  plans: () => request<Paginated<Plan>>("GET", "/plans?limit=100"),
  createPlan: (input: SavePlanInput) => request<void>("POST", "/plans", input),
  updatePlan: (id: string, input: SavePlanInput) => request<void>("PATCH", `/plans/${id}`, input),
};
