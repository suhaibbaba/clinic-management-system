import { useMemo, type JSX, type ReactNode } from "react";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { EditorContext } from "@web/modules/website/lib/editor-context";
import { joinPath } from "@web/modules/website/lib/site-draft";

export function EditorScope({
  path,
  root = false,
  children,
}: {
  readonly path: string;
  readonly root?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  const editor = useEditor();
  const value = useMemo(
    () => ({ ...editor, scope: root ? path : joinPath(editor.scope, path) }),
    [editor, path, root],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
