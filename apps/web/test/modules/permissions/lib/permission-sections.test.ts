import { describe, expect, it } from "vitest";
import { buildSections, filterSections } from "@web/modules/permissions/lib/permission-sections";

const LABELS: Record<string, string> = {
  "permissions.resources.patients": "المرضى",
  "permissions.resources.attachments": "المرضى",
  "permissions.resources.labs": "المختبرات",
  "permissions.hints.patients": "ملف المريض",
  "permissions.capabilities.patients.create": "إضافة مريض",
  "permissions.capabilities.patients.update": "تعديل مريض",
  "permissions.capabilities.attachments.remove": "حذف مرفق",
  "permissions.capabilities.patient-attachments.presignUpload": "رفع مرفق",
  "permissions.capabilities.labs.create": "إضافة مختبر",
};

const t = (key: string, options: { defaultValue: string }): string =>
  LABELS[key] ?? options.defaultValue;

const sections = buildSections(
  [
    { key: "patients.update", resource: "patients" },
    { key: "patients.create", resource: "patients" },
    { key: "attachments.remove", resource: "attachments" },
    { key: "patient-attachments.presignUpload", resource: "patients" },
    { key: "patient-attachments.confirmUpload", resource: "patients" },
    { key: "labs.create", resource: "labs" },
    { key: "labs.unknown", resource: "labs" },
  ],
  t,
  "ar",
);

describe("permission sections", () => {
  it("groups resources that share a title, sorted by title", () => {
    expect(sections.map((section) => section.title)).toEqual(["المختبرات", "المرضى"]);
  });

  it("folds the confirm step into its upload and sorts rows by label", () => {
    expect(sections[1]?.permissions).toEqual([
      { keys: ["patients.create"], label: "إضافة مريض" },
      { keys: ["patients.update"], label: "تعديل مريض" },
      { keys: ["attachments.remove"], label: "حذف مرفق" },
      {
        keys: ["patient-attachments.presignUpload", "patient-attachments.confirmUpload"],
        label: "رفع مرفق",
      },
    ]);
  });

  it("takes the first hint found for a merged section", () => {
    expect(sections[1]?.hint).toBe("ملف المريض");
  });

  it("falls back to the capability key when a label is missing", () => {
    expect(sections[0]?.permissions.map((row) => row.label)).toContain("labs.unknown");
  });

  it("keeps a whole section when its title matches", () => {
    expect(filterSections(sections, "المختبرات")).toEqual([sections[0]]);
  });

  it("keeps only the matching rows otherwise, ignoring hamza forms", () => {
    const found = filterSections(sections, "اضافة");

    expect(found.map((section) => section.permissions.map((row) => row.label))).toEqual([
      ["إضافة مختبر"],
      ["إضافة مريض"],
    ]);
  });

  it("returns everything for an empty search and nothing for no match", () => {
    expect(filterSections(sections, "  ")).toEqual(sections);
    expect(filterSections(sections, "zzz")).toEqual([]);
  });
});
