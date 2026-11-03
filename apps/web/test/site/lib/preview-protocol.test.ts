import {
  readSiteEditorMessage,
  readSitePreviewMessage,
  SITE_PAGE_KIND,
  SITE_PREVIEW_MESSAGE,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";

describe("site editor messages", () => {
  it("reads each action the site may send", () => {
    const base = { kind: SITE_PAGE_KIND.HOME, id: "cases" };

    expect(readSiteEditorMessage({ type: SITE_PREVIEW_MESSAGE.EDIT, ...base })).toEqual({
      type: SITE_PREVIEW_MESSAGE.EDIT,
      ...base,
    });
    expect(
      readSiteEditorMessage({ type: SITE_PREVIEW_MESSAGE.MOVE, ...base, delta: 1 }),
    ).not.toBeNull();
    expect(readSiteEditorMessage({ type: SITE_PREVIEW_MESSAGE.REMOVE, ...base })).not.toBeNull();
    expect(
      readSiteEditorMessage({
        type: SITE_PREVIEW_MESSAGE.INSERT,
        kind: SITE_PAGE_KIND.ABOUT,
        index: 2,
      }),
    ).not.toBeNull();
  });

  it("refuses anything else", () => {
    expect(readSiteEditorMessage(null)).toBeNull();
    expect(readSiteEditorMessage({ type: SITE_PREVIEW_MESSAGE.READY })).toBeNull();
    expect(
      readSiteEditorMessage({ type: "clinic-site-preview-duplicate", kind: "home", id: "cases" }),
    ).toBeNull();
    expect(
      readSiteEditorMessage({
        type: SITE_PREVIEW_MESSAGE.MOVE,
        kind: "home",
        id: "cases",
        delta: 3,
      }),
    ).toBeNull();
    expect(
      readSiteEditorMessage({ type: SITE_PREVIEW_MESSAGE.EDIT, kind: "account", id: "cases" }),
    ).toBeNull();
    expect(
      readSiteEditorMessage({ type: SITE_PREVIEW_MESSAGE.EDIT, kind: "home", id: "Not An Id" }),
    ).toBeNull();
  });
});

describe("site preview message", () => {
  const site = { clinic: {} };

  it("reads the site without edit mode", () => {
    expect(readSitePreviewMessage({ type: SITE_PREVIEW_MESSAGE.SITE, site })).toEqual({
      site,
      edit: null,
    });
  });

  it("reads edit mode and the block being edited", () => {
    expect(
      readSitePreviewMessage({ type: SITE_PREVIEW_MESSAGE.SITE, site, edit: { editing: "hero" } }),
    ).toEqual({ site, edit: { editing: "hero" } });
    expect(readSitePreviewMessage({ type: SITE_PREVIEW_MESSAGE.SITE, site, edit: {} })).toEqual({
      site,
      edit: { editing: null },
    });
  });

  it("ignores other messages", () => {
    expect(readSitePreviewMessage({ type: SITE_PREVIEW_MESSAGE.READY })).toBeNull();
    expect(readSitePreviewMessage({ type: SITE_PREVIEW_MESSAGE.SITE })).toBeNull();
  });
});
