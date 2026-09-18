import { useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button, Icon, PersonName, Widget } from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { useCreateNote, useDeleteNote, useNotes } from "@web/features/notes/queries";
import { formatDate } from "@web/lib/format";
import { cn } from "@clinic/ui/lib/cn";

// The clinic's noticeboard, not a patient's record: one line the next person at the desk needs to
// read. Anything about a patient belongs on the patient, where it is scoped and audited as such.
export function NotesWidget(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const notes = useNotes();
  const create = useCreateNote();
  const remove = useDeleteNote();
  const [draft, setDraft] = useState("");

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const body = draft.trim();

    if (body.length < 2) {
      return;
    }

    create.mutate({ body }, { onSuccess: () => setDraft("") });
  };

  return (
    <Widget title={t("notes.title")} data-testid="notes-widget">
      <ul data-testid="notes-list" className="flex flex-col">
        {(notes.data?.items ?? []).map((note) => {
          const canRemove = user?.role === "admin" || note.authorId === user?.id;

          return (
            <li
              key={note.id}
              data-testid={`note-${note.id}`}
              className={cn(
                "mt-2.5 flex items-start gap-2 rounded-control border border-note-line bg-note-bg",
                "px-3 py-2.5 text-meta text-note-ink",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="break-words">{note.body}</p>
                <small className="mt-[3px] flex flex-wrap items-center gap-1 text-micro text-note-meta">
                  <span>{formatDate(note.createdAt)}</span>
                  {note.authorName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <PersonName name={note.authorName} />
                    </>
                  )}
                </small>
              </div>

              {canRemove && (
                <Button
                  size="sm"
                  variant="quiet"
                  className="shrink-0 hover:text-danger-600"
                  icon={<Icon name="trash" />}
                  data-testid={`note-remove-${note.id}`}
                  aria-label={t("notes.remove")}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(note.id)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {notes.data?.items.length === 0 && (
        <p data-testid="notes-empty" className="mt-2.5 text-meta text-ink-subtle">
          {t("notes.empty")}
        </p>
      )}

      {/* A dashed box rather than a field: it reads as somewhere to add rather than somewhere to
          search, which is the difference the reference draws. */}
      <form
        data-testid="notes-form"
        onSubmit={submit}
        className={cn(
          "mt-3 flex items-center gap-2 rounded-control border border-dashed border-line px-3",
          "min-h-(--control-h) lg:min-h-(--control-h-sm)",
        )}
      >
        <Icon name="edit" className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
        <input
          type="text"
          data-testid="notes-input"
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={t("notes.add")}
          placeholder={t("notes.placeholder")}
          className={cn(
            "w-full min-w-0 self-stretch border-none bg-transparent text-field text-ink outline-none",
            "placeholder:text-ink-subtle",
          )}
        />
        {draft.trim().length >= 2 && (
          <button
            type="submit"
            data-testid="notes-save"
            disabled={create.isPending}
            aria-label={t("notes.save")}
            className={cn(
              "inline-flex size-(--control-h) shrink-0 cursor-pointer items-center justify-center rounded-chip",
              "lg:size-(--control-h-sm)",
              "bg-primary-600 text-ink-inverse transition-[filter] duration-150",
              "hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Icon name="check" className="size-3.5" />
          </button>
        )}
      </form>
    </Widget>
  );
}
