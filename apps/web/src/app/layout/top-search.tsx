import { useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Icon, Ltr, SearchField } from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { canOpenPatientFile } from "@web/shared/permissions/patients";
import { usePatients } from "@web/shared/queries/patients";
import { useDebounced } from "@web/shared/hooks/use-debounced";
import { ellipsis } from "@web/i18n/ellipsis";
import { PATIENTS_PATH, SEARCH_MIN_TERM, SEARCH_SUGGESTIONS } from "@web/shared/constants/layout";

export interface TopSearchProps {
  readonly onDismiss?: (() => void) | undefined;
}

export function TopSearch({ onDismiss }: TopSearchProps): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const { user, can } = useSession();

  const onList = pathname === PATIENTS_PATH;
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const panelId = "top-search-results";
  const panel = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [under, setUnder] = useState(0);

  const term = onList ? (params.get("q") ?? "") : typed;
  const debounced = useDebounced(typed).trim();
  const suggest =
    !onList && user !== null && canOpenPatientFile(can) && debounced.length >= SEARCH_MIN_TERM;
  const results = usePatients(
    { search: debounced, limit: SEARCH_SUGGESTIONS },
    { enabled: suggest },
  );
  const rows = results.data?.items ?? [];
  const total = results.data?.total ?? 0;
  const showing = suggest && open;

  useLayoutEffect(() => {
    if (showing && form.current) {
      setUnder(form.current.getBoundingClientRect().bottom + 8);
    }
  }, [showing, rows.length]);

  const write = (next: string): void => {
    if (!onList) {
      setTyped(next);
      setOpen(true);
      return;
    }

    const merged = new URLSearchParams(params);

    if (next.trim() === "") {
      merged.delete("q");
    } else {
      merged.set("q", next);
    }

    setParams(merged, { replace: true });
  };

  const toList = (): void => {
    setOpen(false);
    navigate(term.trim() === "" ? PATIENTS_PATH : `${PATIENTS_PATH}?q=${encodeURIComponent(term)}`);
  };

  const openFile = (id: string): void => {
    setOpen(false);
    setTyped("");
    navigate(`${PATIENTS_PATH}/${id}`);
  };

  return (
    <form
      ref={form}
      data-testid="top-search"
      role="search"
      className="relative min-w-0 flex-1 md:max-w-[520px]"
      onSubmit={(event) => {
        event.preventDefault();

        if (!onList) {
          toList();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <SearchField
        data-testid="top-search-field"
        label={t("nav.search")}
        placeholder={ellipsis(t("nav.searchPlaceholder"))}
        value={term}
        role="combobox"
        aria-expanded={showing}
        aria-controls={panelId}
        onChange={(event) => write(event.target.value)}
        clearLabel={t("common.clear")}
        onClear={() => {
          write("");
          setOpen(false);
          onDismiss?.();
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (showing && term !== "") setOpen(false);
            else onDismiss?.();
          }
          if (event.key === "ArrowDown" && showing) {
            event.preventDefault();
            panel.current?.querySelector("button")?.focus();
          }
        }}
      />

      {showing && (
        <div
          id={panelId}
          ref={panel}
          data-part="search-results"
          data-testid="top-search-results"
          style={{ "--panel-top": `${under}px` } as CSSProperties}
          className="fixed inset-x-4 top-(--panel-top) z-40 rounded-panel border border-line bg-surface p-1.5 shadow-float md:absolute md:inset-x-0 md:top-full md:mt-2"
          onMouseDown={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            const buttons = [...(panel.current?.querySelectorAll("button") ?? [])];
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            const field = form.current?.querySelector("input");

            if (event.key === "Escape") {
              event.preventDefault();
              field?.focus();
              setOpen(false);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              buttons[Math.min(index + 1, buttons.length - 1)]?.focus();
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              if (index <= 0) {
                field?.focus();
              } else {
                buttons[index - 1]?.focus();
              }
            }
          }}
        >
          {rows.length === 0 ? (
            <p data-testid="top-search-empty" className="px-3 py-2 text-label text-ink-muted">
              {results.isPending ? ellipsis(t("common.loading")) : t("nav.searchEmpty")}
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    data-testid={`top-search-result-${row.id}`}
                    className="flex w-full min-h-(--control-h) cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-start transition-colors duration-[250ms] ease-in-out hover:bg-inset"
                    onClick={() => openFile(row.id)}
                  >
                    <span className="truncate text-value text-ink">{row.fullName}</span>
                    <Ltr className="shrink-0 text-meta text-ink-muted">{row.fileNumber}</Ltr>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            data-testid="top-search-all"
            className="mt-1 flex w-full min-h-(--control-h) cursor-pointer items-center justify-center gap-1.5 rounded-control border-t border-line px-3 py-2 text-label font-medium text-primary-600 transition-colors duration-[250ms] ease-in-out hover:bg-inset"
            onClick={toList}
          >
            {t("nav.searchAll", { count: total })}
            <Icon name="chevron-end" className="size-4" />
          </button>
        </div>
      )}
    </form>
  );
}
