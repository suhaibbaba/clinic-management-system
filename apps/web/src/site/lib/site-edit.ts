import type { SiteEditorMessage } from "@clinic/shared";

export function postToEditor(message: SiteEditorMessage): void {
  window.parent.postMessage(message, window.location.origin);
}
