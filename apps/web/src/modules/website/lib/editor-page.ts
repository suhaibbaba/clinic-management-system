import {
  moveBlock,
  removeBlock,
  SITE_PAGE_KIND,
  SITE_PAGE_KINDS,
  SITE_PREVIEW_MESSAGE,
  SITE_BLOCK_TYPE,
  type SiteBlock,
  type SiteDocument,
  type SiteEditorMessage,
  type SitePageKind,
} from "@clinic/shared";
import { WEBSITE_EDITOR_PATH } from "@web/shared/constants/layout";
import {
  DOCTORS_COLLECTION_PATH,
  EDITOR_PARAMS,
  SERVICES_COLLECTION_PATH,
  SITE_LANGUAGE_QUERY,
  SITE_PAGE_PATHS,
} from "@web/modules/website/constants";

export interface BlockTarget {
  readonly kind: SitePageKind;
  readonly id: string;
}

const BLOCK_ERROR = /^pages\.(\d+)\.blocks\.(\d+)(\.|$)/;

export const isSitePageKind = (value: unknown): value is SitePageKind =>
  SITE_PAGE_KINDS.some((kind) => kind === value);

export const editorPageKind = (value: string | null): SitePageKind =>
  isSitePageKind(value) ? value : SITE_PAGE_KIND.HOME;

export const editParam = (target: BlockTarget): string => `${target.kind}.${target.id}`;

export function readEditParam(value: string | null): BlockTarget | null {
  const dot = value?.indexOf(".") ?? -1;

  if (value === null || dot < 0) {
    return null;
  }

  const kind = value.slice(0, dot);
  const id = value.slice(dot + 1);

  return isSitePageKind(kind) && id.length > 0 ? { kind, id } : null;
}

export function blockErrorScopes(block: SiteBlock, path: string): readonly string[] {
  switch (block.type) {
    case SITE_BLOCK_TYPE.SERVICES_GRID:
      return [path, SERVICES_COLLECTION_PATH];
    case SITE_BLOCK_TYPE.DOCTORS_GRID:
      return [path, DOCTORS_COLLECTION_PATH];
    default:
      return [path];
  }
}

export const inErrorScope = (key: string, scopes: readonly string[]): boolean =>
  scopes.some((scope) => key === scope || key.startsWith(`${scope}.`));

export const isBlockError = (key: string): boolean => BLOCK_ERROR.test(key);

export function blockPath(document: SiteDocument, kind: SitePageKind, id: string): string | null {
  const pageIndex = document.pages.findIndex((page) => page.kind === kind);
  const blockIndex = document.pages[pageIndex]?.blocks.findIndex((block) => block.id === id) ?? -1;

  return pageIndex < 0 || blockIndex < 0 ? null : `pages.${pageIndex}.blocks.${blockIndex}`;
}

export function findBlock(
  document: SiteDocument,
  kind: SitePageKind,
  id: string | null,
): SiteBlock | undefined {
  return id === null
    ? undefined
    : document.pages.find((page) => page.kind === kind)?.blocks.find((block) => block.id === id);
}

export function firstInvalidBlock(
  document: SiteDocument,
  errorKeys: readonly string[],
): BlockTarget | null {
  for (const key of errorKeys) {
    const match = BLOCK_ERROR.exec(key);
    const page = match ? document.pages[Number(match[1])] : undefined;
    const block = match ? page?.blocks[Number(match[2])] : undefined;

    if (page && block) {
      return { kind: page.kind, id: block.id };
    }
  }

  return null;
}

export function previewPath(kind: SitePageKind, language: string, primary: string): string {
  const path = SITE_PAGE_PATHS[kind];

  return language === primary
    ? path
    : `${path}?${new URLSearchParams({ [SITE_LANGUAGE_QUERY]: language }).toString()}`;
}

export function applyBlockMessage(
  document: SiteDocument,
  message: SiteEditorMessage,
): SiteDocument {
  switch (message.type) {
    case SITE_PREVIEW_MESSAGE.MOVE:
      return moveBlock(document, message.kind, message.id, message.delta);
    case SITE_PREVIEW_MESSAGE.REMOVE:
      return removeBlock(document, message.kind, message.id);
    default:
      return document;
  }
}

export function editorAddress(params: URLSearchParams): string | null {
  const kept = new URLSearchParams();

  for (const key of EDITOR_PARAMS) {
    const value = params.get(key);

    if (value !== null) {
      kept.set(key, value);
    }
  }

  const query = kept.toString();

  return query === "" ? null : `${WEBSITE_EDITOR_PATH}?${query}`;
}
