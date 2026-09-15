import { useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Icon, Ltr, SearchField } from '@clinic/ui';
import { useSession } from '@web/features/auth/session';
import { canOpenPatientFile } from '@web/features/patients/permissions';
import { usePatients } from '@web/features/patients/queries';
import { useDebounced } from '@web/lib/use-debounced';

const PATIENTS = '/patients';
/** Enough to answer with, few enough to read without scrolling the bar's panel. */
const SUGGESTIONS = 5;
const MIN_TERM = 2;

export function TopSearch(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const { user } = useSession();

  const onList = pathname === PATIENTS;
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const panelId = 'top-search-results';
  const panel = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  // On a phone the field is a sliver between the bell and the burger, so the panel is pinned to the
  // screen under the bar instead of to the field. Measured, because the bar's height is its own.
  const [under, setUnder] = useState(0);

  const term = onList ? (params.get('q') ?? '') : typed;
  const debounced = useDebounced(typed).trim();
  const suggest = !onList && canOpenPatientFile(user?.role) && debounced.length >= MIN_TERM;
  const results = usePatients({ search: debounced, limit: SUGGESTIONS }, { enabled: suggest });
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

    if (next.trim() === '') {
      merged.delete('q');
    } else {
      merged.set('q', next);
    }

    setParams(merged, { replace: true });
  };

  const toList = (): void => {
    setOpen(false);
    navigate(term.trim() === '' ? PATIENTS : `${PATIENTS}?q=${encodeURIComponent(term)}`);
  };

  const openFile = (id: string): void => {
    setOpen(false);
    setTyped('');
    navigate(`${PATIENTS}/${id}`);
  };

  return (
    <form
      ref={form}
      role="search"
      // Shares the bar's one row at every width. `w-full order-last` gave it a row of its own on a
      // phone, which made the header two rows tall on every single page.
      className="relative min-w-0 flex-1 md:max-w-[520px]"
      onSubmit={(event) => {
        event.preventDefault();

        if (!onList) {
          toList();
        }
      }}
      // The panel closes when the focus leaves the field and everything under it, so a click on a
      // result is not cut off by a blur.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <SearchField
        label={t('nav.search')}
        placeholder={t('nav.searchPlaceholder')}
        value={term}
        role="combobox"
        aria-expanded={showing}
        aria-controls={panelId}
        onChange={(event) => write(event.target.value)}
        clearLabel={t('common.clear')}
        // Empties the field and takes the panel with it — the panel is the term's answer.
        onClear={() => {
          write('');
          setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
          if (event.key === 'ArrowDown' && showing) {
            event.preventDefault();
            panel.current?.querySelector('button')?.focus();
          }
        }}
      />

      {showing && (
        <div
          id={panelId}
          ref={panel}
          data-part="search-results"
          // The measurement travels as a variable, or an inline `top` would also win at `md`, where
          // the panel hangs off the field again.
          style={{ '--panel-top': `${under}px` } as CSSProperties}
          className="fixed inset-x-4 top-(--panel-top) z-40 rounded-panel border border-line bg-surface p-1.5 shadow-float md:absolute md:inset-x-0 md:top-full md:mt-2"
          // Safari gives a button no focus on mousedown, so the field's blur would close this panel
          // before the click landed on anything. Keeping the focus in the field keeps it open.
          onMouseDown={(event) => event.preventDefault()}
        >
          {rows.length === 0 ? (
            <p className="px-3 py-2 text-label text-ink-muted">
              {results.isPending ? t('common.loading') : t('nav.searchEmpty')}
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
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
            className="mt-1 flex w-full min-h-(--control-h) cursor-pointer items-center justify-center gap-1.5 rounded-control border-t border-line px-3 py-2 text-label font-medium text-primary-600 transition-colors duration-[250ms] ease-in-out hover:bg-inset"
            onClick={toList}
          >
            {t('nav.searchAll', { count: total })}
            <Icon name="chevron-end" className="size-4" />
          </button>
        </div>
      )}
    </form>
  );
}
