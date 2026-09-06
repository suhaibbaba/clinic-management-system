import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { Logo } from '@web/components/brand/logo';
import { Breadcrumb } from '@web/components/layout/breadcrumb';
import { UserMenu } from '@web/components/layout/user-menu';
import { Button, Icon } from '@web/components/ui';
import { visibleNavItems } from '@web/app/navigation';
import { useSession } from '@web/features/auth/session';
import { cn } from '@web/lib/cn';

/**
 * The signed-in shell: a translucent sidebar, a frosted top bar, and the page
 * on the grey ground beside them.
 *
 * The sidebar is a flat list — no chips, no card per row. An active item is a
 * faint grey fill and a heavier weight, which answers "where am I" without
 * spending the page's one accent colour on navigation. The icons take the
 * blue, because a row is a link.
 *
 * The sidebar lists only what the role can reach. That is presentation: the
 * matching route guard and, above all, the API enforce the same rule.
 */
export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = visibleNavItems(user?.role);

  /*
   * `/` focuses the page's own search.
   *
   * The top bar has no search field in this design — each page owns one — so
   * the shortcut looks for the first search input on the page rather than
   * holding a ref to one. Never while the user is already typing somewhere,
   * which would swallow the slash out of an address or a note.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey) {
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');

        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside
        className={cn(
          'chrome-sidebar z-30 shrink-0 md:w-[250px]',
          'md:sticky md:top-0 md:h-screen md:overflow-y-auto',
          'border-b border-line md:border-b-0 md:border-e',
          mobileOpen ? 'block' : 'hidden md:block',
        )}
      >
        <div className="flex h-full flex-col px-3 py-4">
          <div className="mb-6 flex items-center gap-2.5 px-3">
            <Logo size="sm" />
            <span className="text-value font-semibold tracking-[-0.03em] text-ink">
              {t('app.title')}
            </span>
          </div>

          <nav aria-label={t('nav.menu')} className="min-w-0 flex-1">
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-value',
                        'transition-colors duration-150',
                        isActive
                          ? 'chrome-active font-semibold text-ink'
                          : 'text-ink hover:bg-inset',
                      )
                    }
                  >
                    <Icon name={item.icon} className="text-primary-600" />
                    <span className="truncate">{t(item.label)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* The account block is pinned at the foot of the rail. */}
          {user && (
            <div className="mt-6 border-t border-line pt-3">
              <UserMenu user={user} onLogout={() => void logout()} />
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="chrome-bar sticky top-0 z-20 border-b border-line">
          <div className="flex h-14 items-center gap-3 px-4 md:px-8">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              icon={<Icon name="menu" />}
              aria-label={t('nav.menu')}
            />

            <Breadcrumb />

            <div className="ms-auto flex items-center gap-1">
              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto w-full max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * The bell.
 *
 * No feed behind it yet — notifications are a phase-2 module — so it carries
 * no count and says so, rather than a decorative red dot that would train
 * everyone to ignore the real one when it arrives.
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
        'inline-flex size-9 cursor-pointer items-center justify-center rounded-pill',
        'text-ink-subtle transition-colors duration-150 hover:bg-inset hover:text-ink',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      <Icon name="bell" />
    </button>
  );
}
