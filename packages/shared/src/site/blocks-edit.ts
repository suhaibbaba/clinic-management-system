import {
  SITE_BLOCK_TYPE,
  SITE_PAGE_KIND,
  type SiteBlock,
  type SiteBlockOf,
  type SiteBlockType,
  type SiteDocument,
  type SitePage,
  type SitePageKind,
} from "@shared/schemas/site-blocks";

export const SITE_PAGE_BLOCKS_MAX = 40;

export const FIXED_SITE_BLOCKS: readonly SiteBlockType[] = [
  SITE_BLOCK_TYPE.HERO,
  SITE_BLOCK_TYPE.PAGE_HERO,
  SITE_BLOCK_TYPE.SERVICES_GRID,
  SITE_BLOCK_TYPE.DOCTORS_GRID,
  SITE_BLOCK_TYPE.CONTACT_MAIN,
  SITE_BLOCK_TYPE.BOOKING,
];

export const INSERTABLE_SITE_BLOCKS: readonly SiteBlockType[] = [
  SITE_BLOCK_TYPE.SERVICES_TEASER,
  SITE_BLOCK_TYPE.ABOUT_TEASER,
  SITE_BLOCK_TYPE.CASES,
  SITE_BLOCK_TYPE.DOCTORS_TEASER,
  SITE_BLOCK_TYPE.TESTIMONIALS,
  SITE_BLOCK_TYPE.GALLERY,
  SITE_BLOCK_TYPE.ABOUT_PILLARS,
  SITE_BLOCK_TYPE.ABOUT_VALUES,
  SITE_BLOCK_TYPE.CONTACT_WELCOME,
];

const LEADING_BLOCKS: readonly SiteBlockType[] = [SITE_BLOCK_TYPE.HERO, SITE_BLOCK_TYPE.PAGE_HERO];

const CLOSED_PAGES: readonly SitePageKind[] = [SITE_PAGE_KIND.BOOKING];

type BlockBody<TBlock> = TBlock extends SiteBlock ? Omit<TBlock, "id"> : never;

export type SiteBlockPatch =
  BlockBody<SiteBlock> extends infer TBody
    ? TBody extends { type: SiteBlockType }
      ? Partial<Omit<TBody, "type">>
      : never
    : never;

export interface SiteBlockActions {
  readonly up: boolean;
  readonly down: boolean;
  readonly duplicate: boolean;
  readonly remove: boolean;
}

export const isFixedSiteBlock = (type: SiteBlockType): boolean => FIXED_SITE_BLOCKS.includes(type);

export const insertableBlocks = (kind: SitePageKind): readonly SiteBlockType[] =>
  CLOSED_PAGES.includes(kind) ? [] : INSERTABLE_SITE_BLOCKS;

export const canDisablePage = (kind: SitePageKind): boolean => kind !== SITE_PAGE_KIND.HOME;

const kebab = (type: SiteBlockType): string =>
  type.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export function uniqueBlockId(type: SiteBlockType, existingIds: readonly string[]): string {
  const base = kebab(type);

  if (!existingIds.includes(base)) {
    return base;
  }

  let count = 2;

  while (existingIds.includes(`${base}-${count}`)) {
    count += 1;
  }

  return `${base}-${count}`;
}

const blankBlock = (type: SiteBlockType): BlockBody<SiteBlock> => {
  switch (type) {
    case SITE_BLOCK_TYPE.HERO:
      return {
        type,
        eyebrow: {},
        title: {},
        subtitle: {},
        images: [],
        stat: { value: "", label: {} },
        highlights: [],
      };
    case SITE_BLOCK_TYPE.SERVICES_TEASER:
    case SITE_BLOCK_TYPE.DOCTORS_TEASER:
      return { type, title: {}, subtitle: {} };
    case SITE_BLOCK_TYPE.ABOUT_TEASER:
      return {
        type,
        eyebrow: {},
        title: {},
        body: {},
        badge: {},
        image: null,
        storyImage: null,
        stats: [],
        statsImage: null,
      };
    case SITE_BLOCK_TYPE.CASES:
    case SITE_BLOCK_TYPE.TESTIMONIALS:
      return { type, title: {}, subtitle: {}, items: [] };
    case SITE_BLOCK_TYPE.PAGE_HERO:
      return {
        type,
        eyebrow: {},
        title: {},
        subtitle: {},
        intro: {},
        image: null,
        tagline: false,
        features: [],
      };
    case SITE_BLOCK_TYPE.SERVICES_GRID:
    case SITE_BLOCK_TYPE.DOCTORS_GRID:
      return { type };
    case SITE_BLOCK_TYPE.ABOUT_PILLARS:
      return { type, note: {}, pillars: [], quote: { text: {}, image: null } };
    case SITE_BLOCK_TYPE.ABOUT_VALUES:
      return { type, title: {}, values: [], image: null, badge: {} };
    case SITE_BLOCK_TYPE.GALLERY:
      return { type, eyebrow: {}, title: {}, body: {}, images: [] };
    case SITE_BLOCK_TYPE.CONTACT_MAIN:
      return { type, note: {}, formEnabled: true, topics: [] };
    case SITE_BLOCK_TYPE.CONTACT_WELCOME:
      return { type, title: {}, body: {}, image: null };
    case SITE_BLOCK_TYPE.BOOKING:
      return { type, title: {}, subtitle: {}, image: null };
  }
};

export function newBlock<TType extends SiteBlockType>(
  type: TType,
  existingIds: readonly string[],
): SiteBlockOf<TType> {
  return { id: uniqueBlockId(type, existingIds), ...blankBlock(type) } as SiteBlockOf<TType>;
}

const pageOf = (document: SiteDocument, kind: SitePageKind): SitePage | undefined =>
  document.pages.find((page) => page.kind === kind);

const withPage = (
  document: SiteDocument,
  kind: SitePageKind,
  change: (page: SitePage) => SitePage,
): SiteDocument => {
  const page = pageOf(document, kind);

  if (!page) {
    return document;
  }

  const next = change(page);

  return next === page
    ? document
    : { ...document, pages: document.pages.map((current) => (current === page ? next : current)) };
};

const leadingCount = (blocks: readonly SiteBlock[]): number =>
  blocks[0] !== undefined && LEADING_BLOCKS.includes(blocks[0].type) ? 1 : 0;

export function blockActions(
  document: SiteDocument,
  kind: SitePageKind,
  id: string,
): SiteBlockActions {
  const blocks = pageOf(document, kind)?.blocks ?? [];
  const index = blocks.findIndex((block) => block.id === id);
  const block = blocks[index];

  if (!block || isFixedSiteBlock(block.type)) {
    return { up: false, down: false, duplicate: false, remove: false };
  }

  return {
    up: index - 1 >= leadingCount(blocks),
    down: index + 1 < blocks.length,
    duplicate: blocks.length < SITE_PAGE_BLOCKS_MAX,
    remove: true,
  };
}

export function insertBlock(
  document: SiteDocument,
  kind: SitePageKind,
  index: number,
  block: SiteBlock,
): SiteDocument {
  if (!insertableBlocks(kind).includes(block.type)) {
    return document;
  }

  return withPage(document, kind, (page) => {
    if (
      page.blocks.length >= SITE_PAGE_BLOCKS_MAX ||
      page.blocks.some((current) => current.id === block.id)
    ) {
      return page;
    }

    const at = Math.min(Math.max(index, leadingCount(page.blocks)), page.blocks.length);
    const blocks = [...page.blocks];
    blocks.splice(at, 0, block);

    return { ...page, blocks };
  });
}

export function moveBlock(
  document: SiteDocument,
  kind: SitePageKind,
  id: string,
  delta: -1 | 1,
): SiteDocument {
  const allowed = blockActions(document, kind, id);

  if (delta === -1 ? !allowed.up : !allowed.down) {
    return document;
  }

  return withPage(document, kind, (page) => {
    const index = page.blocks.findIndex((block) => block.id === id);
    const blocks = [...page.blocks];
    const [moved] = blocks.splice(index, 1);

    if (moved) {
      blocks.splice(index + delta, 0, moved);
    }

    return { ...page, blocks };
  });
}

export function duplicateBlock(
  document: SiteDocument,
  kind: SitePageKind,
  id: string,
): SiteDocument {
  if (!blockActions(document, kind, id).duplicate) {
    return document;
  }

  return withPage(document, kind, (page) => {
    const index = page.blocks.findIndex((block) => block.id === id);
    const source = page.blocks[index];

    if (!source) {
      return page;
    }

    const copy = {
      ...(JSON.parse(JSON.stringify(source)) as SiteBlock),
      id: uniqueBlockId(
        source.type,
        page.blocks.map((block) => block.id),
      ),
    };
    const blocks = [...page.blocks];
    blocks.splice(index + 1, 0, copy);

    return { ...page, blocks };
  });
}

export function removeBlock(document: SiteDocument, kind: SitePageKind, id: string): SiteDocument {
  if (!blockActions(document, kind, id).remove) {
    return document;
  }

  return withPage(document, kind, (page) => ({
    ...page,
    blocks: page.blocks.filter((block) => block.id !== id),
  }));
}

export function updateBlock(
  document: SiteDocument,
  kind: SitePageKind,
  id: string,
  patch: SiteBlockPatch,
): SiteDocument {
  return withPage(document, kind, (page) => {
    if (!page.blocks.some((block) => block.id === id)) {
      return page;
    }

    return {
      ...page,
      blocks: page.blocks.map((block) =>
        block.id === id
          ? ({ ...block, ...patch, id: block.id, type: block.type } as SiteBlock)
          : block,
      ),
    };
  });
}

export function setPageEnabled(
  document: SiteDocument,
  kind: SitePageKind,
  enabled: boolean,
): SiteDocument {
  if (!enabled && !canDisablePage(kind)) {
    return document;
  }

  return withPage(document, kind, (page) =>
    page.enabled === enabled ? page : { ...page, enabled },
  );
}
