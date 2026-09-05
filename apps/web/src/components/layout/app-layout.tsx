import { useEffect, useRef, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Logo } from '@web/components/brand/logo';
import { Avatar, Button, Icon, SearchField } from '@web/components/ui';
import { visibleNavItems } from '@web/app/navigation';
import { useSession } from '@web/features/auth/session';
import { cn } from '@web/lib/cn';

/**
 * The signed-in shell: a floating sidebar panel, a floating top bar, and the
 * page itself on the tinted ground between them.
 *
 * Nothing here spans edge to edge. The sidebar and the top bar are cards like
 * any other, which is what makes the ground read as a ground rather than as
 * the gap between two headers.
 *
 * The sidebar lists only what the role can reach. That is presentation: the
 * matching route guard and, above all, the API enforce the same rule.
 */
export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [term, setTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const items = visibleNavItems(user?.role);

  // `/` focuses search, the way every list-heavy tool does it — but never
  // while the user is already typing somewhere, which would swallow the slash
  // out of an address or a note.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submitSearch = (): void => {
    const query = term.trim();

    if (query !== '') {
      navigate(`/patients?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:flex-row md:gap-5 md:p-5">
      <nav
        aria-label={t('nav.menu')}
        className={cn(
          'shrink-0 rounded-card bg-surface p-3 shadow-panel md:w-60',
          'md:sticky md:top-5 md:h-[calc(100vh-2.5rem)] md:overflow-y-auto',
          mobileOpen ? 'block' : 'hidden md:block',
        )}
      >
        <div className="mb-4 flex items-center gap-2.5 px-2 pt-2">
          <Logo size="sm" />
          <span className="text-value font-semibold text-ink">{t('app.title')}</span>
        </div>

        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-panel px-3 py-2.5 text-value transition-colors',
                    isActive
                      ? 'bg-surface font-semibold text-ink shadow-pill'
                      : 'text-ink-muted hover:bg-sunken hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/*
                      The active row's icon gets a filled brand chip. That chip
                      is the only blue in the sidebar, so "where am I" is
                      answerable from across the room.
                    */}
                    <span
                      className={cn(
                        'inline-flex size-8 shrink-0 items-center justify-center rounded-panel transition-colors',
                        isActive ? 'bg-primary-600 text-ink-inverse' : 'bg-sunken text-ink-muted',
                      )}
                    >
                      <Icon name={item.icon} className="size-[18px]" />
                    </span>
                    {t(item.label)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-5">
        <header className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-panel">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {t('nav.menu')}
          </Button>

          <form
            className="min-w-0 flex-1 md:max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <SearchField
              ref={searchRef}
              label={t('nav.searchPatients')}
              placeholder={t('nav.searchPatients')}
              shortcut="/"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </form>

          <div className="ms-auto flex items-center gap-2">
            <NotificationBell />

            {user && (
              <div className="flex items-center gap-2.5 rounded-pill bg-surface py-1 ps-1 pe-3 shadow-pill">
                <Avatar name={user.name} />
                <span className="hidden min-w-0 flex-col leading-tight sm:flex">
                  <span className="truncate text-label font-semibold text-ink">{user.name}</span>
                  <span className="truncate text-label text-ink-subtle">
                    {t(`roles.${user.role}`)}
                  </span>
                </span>
                <Icon name="chevron-down" className="size-4 text-ink-subtle" />
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void logout()}
              icon={<Icon name="logout" className="size-[18px]" />}
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
            >
              <span className="hidden lg:inline">{t('nav.logout')}</span>
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * The bell.
 *
 * It has no feed behind it yet — notifications are a phase-2 module — so it
 * carries no count and says so, rather than showing a decorative red dot that
 * would train everyone to ignore the real one when it arrives.
 */
function NotificationBell(): JSX.Element {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled
      aria-label={t('nav.notificationsEmpty')}
      title={t('nav.notificationsEmpty')}
      className={cn(
        'relative inline-flex size-10 items-center justify-center rounded-pill',
        'text-ink-subtle transition-colors hover:bg-sunken disabled:cursor-not-allowed',
      )}
    >
      <Icon name="bell" />
    </button>
  );
}
