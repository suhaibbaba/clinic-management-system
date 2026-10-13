import type { Can } from "@web/shared/providers/session";

export const canEditWebsite = (can: Can): boolean => can("website.editor");

export const seesContactMessages = (can: Can): boolean => can("website-messages.list");

export const canHandleContactMessage = (can: Can): boolean => can("website-messages.update");

export const canRemoveContactMessage = (can: Can): boolean => can("website-messages.remove");
