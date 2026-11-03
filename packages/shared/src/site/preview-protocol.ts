import { z } from "zod";
import { siteBlockIdSchema, SITE_PAGE_KINDS, type PublicSite } from "@shared/schemas/site-blocks";
import { SITE_PREVIEW_MESSAGE } from "@shared/schemas/website";

const kind = z.enum(SITE_PAGE_KINDS);

export const sitePreviewEditSchema = z.object({
  editing: siteBlockIdSchema.nullable().default(null),
});
export type SitePreviewEdit = z.infer<typeof sitePreviewEditSchema>;

export const siteEditorMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(SITE_PREVIEW_MESSAGE.EDIT), kind, id: siteBlockIdSchema }),
  z.object({
    type: z.literal(SITE_PREVIEW_MESSAGE.MOVE),
    kind,
    id: siteBlockIdSchema,
    delta: z.union([z.literal(-1), z.literal(1)]),
  }),
  z.object({ type: z.literal(SITE_PREVIEW_MESSAGE.REMOVE), kind, id: siteBlockIdSchema }),
  z.object({
    type: z.literal(SITE_PREVIEW_MESSAGE.INSERT),
    kind,
    index: z.number().int().min(0),
  }),
]);
export type SiteEditorMessage = z.infer<typeof siteEditorMessageSchema>;

export function readSiteEditorMessage(data: unknown): SiteEditorMessage | null {
  const parsed = siteEditorMessageSchema.safeParse(data);

  return parsed.success ? parsed.data : null;
}

export interface SitePreviewPayload {
  readonly site: PublicSite;
  readonly edit: SitePreviewEdit | null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function readSitePreviewMessage(data: unknown): SitePreviewPayload | null {
  if (!isObject(data) || data["type"] !== SITE_PREVIEW_MESSAGE.SITE || !isObject(data["site"])) {
    return null;
  }

  const edit = data["edit"] === undefined ? null : sitePreviewEditSchema.safeParse(data["edit"]);

  return {
    site: data["site"] as PublicSite,
    edit: edit === null ? null : edit.success ? edit.data : { editing: null },
  };
}
