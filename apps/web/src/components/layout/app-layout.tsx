import { useEffect, useRef, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Logo } from '@web/components/brand/logo';
import { UserMenu } from '@web/components/layout/user-menu';
import { Button, Icon, SearchField } from '@web/components/ui';
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
          'shrink-0 rounded-card border border-line-card bg-surface p-3 shadow-card md:w-60',
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
                    'group flex cursor-pointer items-center gap-3 rounded-panel px-3 py-2.5 text-value',
                    'transition-[background-color,color,box-shadow] duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
                    isActive
                      ? 'bg-surface font-semibold text-ink shadow-pill'
                      : 'text-ink-muted hover:bg-inset hover:text-ink',
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
                        'inline-flex size-8 shrink-0 items-center justify-center rounded-panel',
                        'transition-colors duration-150',
                        isActive
                          ? 'bg-primary-600 text-ink-inverse'
                          : 'bg-sunken text-ink-muted group-hover:text-ink',
                      )}
                    >
                      <Icon name={item.icon} />
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
        <header className="flex items-center gap-3 rounded-card border border-line-card bg-surface p-3 shadow-card">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            icon={<Icon name="menu" />}
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
            {user && <UserMenu user={user} onLogout={() => void logout()} />}
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
        'relative inline-flex size-10 cursor-pointer items-center justify-center rounded-pill',
        'text-ink-subtle transition-colors duration-150 hover:bg-inset hover:text-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
      )}
    >
      <Icon name="bell" size="md" />
    </button>
  );
}
