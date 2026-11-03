import {
  SITE_PREVIEW_MESSAGE,
  type SiteBlock,
  type SiteBlockActions,
  type SitePageKind,
} from "@clinic/shared";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, type JSX, type ReactNode, type SyntheticEvent } from "react";
import { cx } from "@web/booking/ui";
import { EditBarButton } from "@web/site/blocks/edit/edit-bar-button";
import { useSite } from "@web/site/hooks/use-site";
import { postToEditor } from "@web/site/lib/site-edit";

export function BlockEditFrame({
  kind,
  block,
  editing,
  actions,
  children,
}: {
  readonly kind: SitePageKind;
  readonly block: SiteBlock;
  readonly editing: boolean;
  readonly actions: SiteBlockActions;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useSite();
  const frame = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const name = t(`editor.blocks.${block.type}`);
  const movable = actions.up || actions.down;
  const target = { kind, id: block.id };

  useEffect(() => {
    if (editing) {
      frame.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [editing]);

  const inert = (event: SyntheticEvent): void => {
    if (event.target instanceof Node && bar.current?.contains(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={frame}
      role="group"
      aria-label={name}
      data-testid={`site-block-edit-${block.id}`}
      data-block-id={block.id}
      data-editing={editing || undefined}
      onClickCapture={inert}
      onSubmitCapture={inert}
      className="group/edit relative"
    >
      {children}
      <span
        aria-hidden="true"
        data-part="border"
        className={cx(
          "pointer-events-none absolute inset-0 z-30 border-2",
          editing
            ? "border-primary-600"
            : "border-transparent group-focus-within/edit:border-primary-300 group-hover/edit:border-primary-300",
        )}
      />
      <div
        ref={bar}
        data-part="bar"
        className={cx(
          "absolute start-2 top-2 z-40 flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5 shadow-float",
          editing
            ? "opacity-100"
            : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 group-hover/edit:pointer-events-auto group-hover/edit:opacity-100",
        )}
      >
        <span data-part="name" className="px-2 text-label font-medium text-primary-700">
          {name}
        </span>
        <EditBarButton
          part="edit"
          icon={Pencil}
          label={t("editor.edit")}
          onPress={() => postToEditor({ type: SITE_PREVIEW_MESSAGE.EDIT, ...target })}
        />
        {movable && (
          <>
            <EditBarButton
              part="up"
              icon={ArrowUp}
              label={t("editor.moveUp")}
              available={actions.up}
              onPress={() =>
                postToEditor({ type: SITE_PREVIEW_MESSAGE.MOVE, ...target, delta: -1 })
              }
            />
            <EditBarButton
              part="down"
              icon={ArrowDown}
              label={t("editor.moveDown")}
              available={actions.down}
              onPress={() => postToEditor({ type: SITE_PREVIEW_MESSAGE.MOVE, ...target, delta: 1 })}
            />
          </>
        )}
        {actions.remove && (
          <EditBarButton
            part="remove"
            icon={Trash2}
            label={t("editor.remove")}
            onPress={() => postToEditor({ type: SITE_PREVIEW_MESSAGE.REMOVE, ...target })}
          />
        )}
      </div>
    </div>
  );
}
