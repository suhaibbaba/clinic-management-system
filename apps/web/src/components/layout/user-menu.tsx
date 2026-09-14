import type { AuthenticatedUserProfile } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '@clinic/ui/components/avatar';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@clinic/ui/components/menu';
import { Icon } from '@clinic/ui/components/icon';
import { PersonName, usePersonName } from '@clinic/ui/components/person-name';
import { WEB_VERSION } from '@web/features/clinic/api-version';
import { changeLanguage, LANGUAGES, type Language } from '@web/i18n/language';
import { cn } from '@clinic/ui/lib/cn';
import { Ltr } from '@clinic/ui/components/ltr';

const LANGUAGE_LABELS: Record<Language, string> = {
  ar: 'العربية', // i18n-allow: a language is named in its own script, never translated
  en: 'English',
};

export interface UserMenuProps {
  readonly user: AuthenticatedUserProfile;
  readonly onLogout: () => void;
}

// The build number sits here because the settings screen that carries the full version panel is
// admin-only, and a version is not a permission.
export function UserMenu({ user, onLogout }: UserMenuProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const displayName = usePersonName();
  const navigate = useNavigate();
  const current = i18n.language.split('-')[0];

  return (
    <Menu>
      <MenuTrigger
        className={cn(
          'group flex w-full cursor-pointer items-center gap-[11px] rounded-panel p-3',
          'border border-line bg-surface transition-colors duration-150',
          'hover:bg-primary-50 data-[state=open]:bg-primary-50',
        )}
      >
        {/* Round and green, as the reference draws the rail's footer: this is the one avatar on the
            page that is not a row in a list, so it does not take a list's rotating tint. */}
        <Avatar
          name={displayName(user.name)}
          size={38}
          className="bg-success-100 text-success-700"
        />

        <span className="flex min-w-0 flex-1 flex-col leading-snug text-start">
          <PersonName name={user.name} className="truncate text-value font-bold text-ink" />
          <span className="truncate text-meta text-ink-muted">{t(`roles.${user.role}`)}</span>
        </span>

        <Icon
          name="chevron-down"
          className={cn(
            'text-ink-subtle transition-transform duration-150',
            'group-data-[state=open]:rotate-180',
          )}
        />
      </MenuTrigger>

      <MenuContent align="start">
        <MenuItem icon="user" onSelect={() => void navigate('/profile')}>
          {t('nav.profile')}
        </MenuItem>

        <MenuSeparator />

        <MenuLabel>{t('nav.language')}</MenuLabel>

        {LANGUAGES.map((language) => (
          <MenuItem
            key={language}
            icon={language === 'ar' ? 'language' : 'globe'}
            onSelect={() => void changeLanguage(language)}
            {...(language === current && {
              trailing: <Icon name="check" className="text-primary-600" />,
            })}
          >
            {LANGUAGE_LABELS[language]}
          </MenuItem>
        ))}

        <MenuSeparator />

        <MenuItem icon="logout" tone="danger" onSelect={onLogout}>
          {t('nav.logout')}
        </MenuItem>

        <MenuSeparator />

        {/* Not a menu item: there is nothing to select, and making it one would put a version number
            in the tab order between "sign out" and the edge. */}
        <p className="px-2 py-1.5 text-meta text-ink-subtle">
          <span>{t('clinic.version')}</span> <Ltr className="font-mono">v{WEB_VERSION}</Ltr>
        </p>
      </MenuContent>
    </Menu>
  );
}
