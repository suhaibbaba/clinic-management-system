import { SITE_SECTIONS, type SiteSection, type SiteText } from "@clinic/shared";

export const blankText = (): SiteText => ({});

export const newItemId = (): string => crypto.randomUUID().slice(0, 8);

export function moveItem<TItem>(list: readonly TItem[], index: number, delta: -1 | 1): TItem[] {
  const target = index + delta;

  if (target < 0 || target >= list.length) {
    return [...list];
  }

  const next = [...list];
  const [item] = next.splice(index, 1);

  if (item !== undefined) {
    next.splice(target, 0, item);
  }

  return next;
}

export const replaceAt = <TItem>(list: readonly TItem[], index: number, item: TItem): TItem[] =>
  list.map((current, position) => (position === index ? item : current));

export const removeAt = <TItem>(list: readonly TItem[], index: number): TItem[] =>
  list.filter((_, position) => position !== index);

export function sectionOrder(visible: readonly SiteSection[]): SiteSection[] {
  return [...visible, ...SITE_SECTIONS.filter((section) => !visible.includes(section))];
}

export function setSectionVisible(
  visible: readonly SiteSection[],
  section: SiteSection,
  shown: boolean,
): SiteSection[] {
  if (!shown) {
    return visible.filter((current) => current !== section);
  }

  return visible.includes(section) ? [...visible] : [...visible, section];
}

type Tree = Readonly<Record<string, unknown>> | readonly unknown[];

export function valueAt(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      source,
    );
}

export function withValueAt<TSource>(source: TSource, path: string, value: unknown): TSource {
  const [head, ...rest] = path.split(".");

  if (head === undefined || head === "") {
    return value as TSource;
  }

  const node = source as unknown as Tree;
  const child = Array.isArray(node) ? node[Number(head)] : (node as Record<string, unknown>)[head];
  const next = rest.length === 0 ? value : withValueAt(child, rest.join("."), value);

  if (Array.isArray(node)) {
    return node.map((item, index) => (index === Number(head) ? next : item)) as TSource;
  }

  return { ...(node as Record<string, unknown>), [head]: next } as TSource;
}
