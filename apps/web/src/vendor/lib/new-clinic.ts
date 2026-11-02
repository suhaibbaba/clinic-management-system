import { createClinicSchema, missingModules, type CreateClinicInput } from "@clinic/shared";

export type NewClinicProblem =
  "name" | "slug" | "domain" | "specialty" | "modules" | "admin" | "phone" | "email";

const PROBLEM_OF_FIELD: Readonly<Record<string, NewClinicProblem>> = {
  name: "name",
  slug: "slug",
  domain: "domain",
  specialties: "specialty",
  modules: "modules",
  firstName: "admin",
  lastName: "admin",
  phone: "phone",
  email: "email",
};

export function newClinicProblems(
  input: CreateClinicInput,
  domainInvalid: boolean,
): NewClinicProblem[] {
  const modulesMissing = missingModules(input.modules).length > 0;
  const parsed = createClinicSchema.safeParse(input);
  const found = parsed.success
    ? []
    : parsed.error.issues.map((issue) => {
        const field = issue.path[issue.path.length - 1];

        return PROBLEM_OF_FIELD[String(issue.path[0] === "admin" ? field : issue.path[0])];
      });

  return [
    ...new Set([
      ...(domainInvalid ? (["domain"] as const) : []),
      ...found,
      ...(modulesMissing ? (["modules"] as const) : []),
    ]),
  ].filter((problem): problem is NewClinicProblem => problem !== undefined);
}
