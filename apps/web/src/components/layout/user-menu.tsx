import type { AuthenticatedUserProfile } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '@web/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@web/components/ui/dropdown-menu';
import { Icon } from '@web/components/ui/icon';
import { WEB_VERSION } from '@web/features/clinic/api-version';
import { changeLanguage, LANGUAGES, type Language } from '@web/i18n/language';
import { cn } from '@web/lib/cn';
import { Ltr } from '@web/components/ui/ltr';

const LANGUAGE_LABELS: Record<Language, string> = {
  ar: 'العربية', // i18n-allow: a language is named in its own script, never translated
  en: 'English',
};

export interface UserMenuProps {
  readonly user: AuthenticatedUserProfile;
  readonly onLogout: () => void;
}

/**
 * The account menu in the header.
 *
 * The trigger is the white pill that was already there — avatar, name, role,
 * chevron — now a real button: it takes focus, opens on Enter or Space, and
 * Radix keeps `aria-expanded` and the `aria-controls` wiring in step. The
 * chevron turns when it is open, which is the only cue that the pill was ever
 * meant to be clicked.
 *
 * The build number sits at the foot of it: the settings screen where the full
 * version panel lives is admin-only, and a version is not a permission.
 *
 * Language is inline rather than a submenu. There are two languages; a submenu
 * would add a hover delay and a second keyboard level to a choice that is one
 * click, and both options fit on screen at once with the current one ticked.
 */
export function UserMenu({ user, onLogout }: UserMenuProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const current = i18n.language.split('-')[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'group flex w-full cursor-pointer items-center gap-2.5 rounded-control p-2',
          'transition-colors duration-150 hover:bg-inset',
          'data-[state=open]:bg-inset',
        )}
      >
        <Avatar name={user.name} />

        <span className="flex min-w-0 flex-1 flex-col leading-snug text-start">
          <span className="truncate text-label font-semibold text-ink">{user.name}</span>
          <span className="truncate text-label text-ink-subtle">{t(`roles.${user.role}`)}</span>
        </span>

        <Icon
          name="chevron-down"
          className={cn(
            'text-ink-subtle transition-transform duration-150',
            'group-data-[state=open]:rotate-180',
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuItem icon="user" onSelect={() => void navigate('/profile')}>
          {t('nav.profile')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t('nav.language')}</DropdownMenuLabel>

        {LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language}
            icon={language === 'ar' ? 'language' : 'globe'}
            onSelect={() => void changeLanguage(language)}
            {...(language === current && {
              trailing: <Icon name="check" className="text-primary-600" />,
            })}
          >
            {LANGUAGE_LABELS[language]}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem icon="logout" tone="danger" onSelect={onLogout}>
          {t('nav.logout')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/*
          Which build this is — the thing somebody reads out over the phone
          when they report a problem.

          Here rather than only on the settings screen, because the settings
          screen is admin-only and the person on the phone is as likely to be
          the receptionist. Not a menu item: there is nothing to select, and
          making it one would put a version number in the keyboard's tab
          order between "sign out" and the edge of the menu.
        */}
        <p className="px-2 py-1.5 text-label text-ink-subtle">
          <span>{t('clinic.version')}</span> <Ltr className="font-mono">v{WEB_VERSION}</Ltr>
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
