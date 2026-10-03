import { normalizeArabic } from "@clinic/shared";
import { FOLDED_CAPABILITIES, PAIRED_CAPABILITIES } from "@web/modules/permissions/constants";

export interface PermissionRow {
  readonly keys: readonly string[];
  readonly label: string;
}

export interface PermissionSection {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly permissions: readonly PermissionRow[];
}

interface CapabilityEntry {
  readonly key: string;
  readonly resource: string;
}

type Translate = (key: string, options: { defaultValue: string }) => string;

export function buildSections(
  capabilities: readonly CapabilityEntry[],
  t: Translate,
  language: string,
): PermissionSection[] {
  const byTitle = new Map<string, { id: string; hint: string; permissions: PermissionRow[] }>();

  for (const capability of capabilities) {
    if (FOLDED_CAPABILITIES.has(capability.key)) {
      continue;
    }

    const title = t(`permissions.resources.${capability.resource}`, {
      defaultValue: capability.resource,
    });
    const section = byTitle.get(title) ?? { id: capability.resource, hint: "", permissions: [] };
    const paired = PAIRED_CAPABILITIES[capability.key];

    section.hint ||= t(`permissions.hints.${capability.resource}`, { defaultValue: "" });
    section.permissions.push({
      keys: paired ? [capability.key, paired] : [capability.key],
      label: t(`permissions.capabilities.${capability.key}`, { defaultValue: capability.key }),
    });
    byTitle.set(title, section);
  }

  return [...byTitle.entries()]
    .map(([title, section]) => ({
      ...section,
      title,
      permissions: section.permissions.sort((a, b) => a.label.localeCompare(b.label, language)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, language));
}

export function filterSections(
  sections: readonly PermissionSection[],
  query: string,
): PermissionSection[] {
  const needle = normalizeArabic(query);

  if (needle === "") {
    return [...sections];
  }

  return sections.flatMap((section) => {
    if (normalizeArabic(section.title).includes(needle)) {
      return [section];
    }

    const permissions = section.permissions.filter((permission) =>
      normalizeArabic(permission.label).includes(needle),
    );

    return permissions.length === 0 ? [] : [{ ...section, permissions }];
  });
}
