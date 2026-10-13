import { useContext } from "react";
import { EditorContext, type EditorValue } from "@web/modules/website/lib/editor-context";

export function useEditor(): EditorValue {
  const value = useContext(EditorContext);

  if (!value) {
    throw new Error("useEditor must be used inside the website editor");
  }

  return value;
}
