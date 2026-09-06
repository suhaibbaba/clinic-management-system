import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { Icon } from '@web/components/ui/icon';
import { NAV_ITEMS } from '@web/app/navigation';

/**
 * Where you are, in the top bar.
 *
 * Built from the nav table rather than from the URL's path segments: a
 * segment is an id as often as it is a name, and `/patients/8f3c…` would
 * otherwise render a UUID as a crumb. The nav table already maps a route to
 * the label a person reads, so the section crumb comes from there and the leaf
 * is supplied by the page that knows what it is showing.
 */
export interface BreadcrumbProps {
  /** The page's own name, when it is deeper than a nav entry. */
  readonly leaf?: string | undefined;
}

export function Breadcrumb({ leaf }: BreadcrumbProps): JSX.Element | null {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const section = NAV_ITEMS.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  if (!section) {
    return null;
  }

  return (
    <nav aria-label={t('nav.breadcrumb')} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-label">
        <li className="shrink-0">
          {leaf === undefined ? (
            <span className="font-medium text-ink" aria-current="page">
              {t(section.label)}
            </span>
          ) : (
            <Link
              to={section.to}
              className="text-ink-muted transition-colors duration-150 hover:text-primary-600"
            >
              {t(section.label)}
            </Link>
          )}
        </li>

        {leaf !== undefined && (
          <>
            <li aria-hidden="true" className="shrink-0 text-ink-subtle">
              <Icon name="chevron-end" className="size-3.5" />
            </li>
            <li className="min-w-0">
              <span className="block truncate font-medium text-ink" aria-current="page">
                {leaf}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
