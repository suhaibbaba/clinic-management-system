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
import { changeLanguage, LANGUAGES, type Language } from '@web/i18n/language';
import { cn } from '@web/lib/cn';

const LANGUAGE_LABELS: Record<Language, string> = {
  ar: 'العربية',
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
          'group flex cursor-pointer items-center gap-2.5 rounded-pill bg-surface py-1 ps-1 pe-3',
          'shadow-pill transition-[background-color,box-shadow] duration-150',
          'hover:bg-inset hover:shadow-float',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
          'data-[state=open]:bg-inset data-[state=open]:shadow-float',
        )}
      >
        <Avatar name={user.name} />

        <span className="hidden min-w-0 flex-col leading-tight text-start sm:flex">
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

      <DropdownMenuContent>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
