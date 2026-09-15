import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { JSX, ReactNode } from 'react';

import { Icon, type IconName } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';
import { documentDirection } from '@ui/lib/direction';

export function Menu({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <DropdownMenuPrimitive.Root dir={documentDirection()}>{children}</DropdownMenuPrimitive.Root>
  );
}

export const MenuTrigger = DropdownMenuPrimitive.Trigger;

export function MenuContent({
  children,
  align = 'end',
  className,
}: {
  readonly children: ReactNode;
  readonly align?: 'start' | 'center' | 'end' | undefined;
  readonly className?: string | undefined;
}): JSX.Element {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-part="menu"
        align={align}
        sideOffset={8}
        className={cn(
          'z-50 min-w-56 rounded-panel border border-line bg-surface p-1.5 shadow-float',
          'origin-(--radix-dropdown-menu-content-transform-origin)',
          'data-[state=open]:animate-[menu-in_150ms_ease-out]',
          'data-[state=closed]:animate-[menu-out_150ms_ease-in]',
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export interface MenuItemProps {
  readonly icon: IconName;
  readonly children: ReactNode;
  readonly onSelect?: (() => void) | undefined;
  readonly tone?: 'default' | 'danger' | undefined;
  readonly trailing?: ReactNode | undefined;
}

export function MenuItem({
  icon,
  children,
  onSelect,
  tone = 'default',
  trailing,
}: MenuItemProps): JSX.Element {
  return (
    <DropdownMenuPrimitive.Item
      data-part="menu-item"
      {...(onSelect && { onSelect })}
      className={cn(
        'flex min-h-(--control-h) cursor-pointer select-none items-center gap-2 rounded-control px-3 py-2',
        'lg:min-h-(--control-h-sm)',
        'text-value outline-none transition-colors duration-150',
        // Radix moves `data-highlighted` with both the pointer and the arrow
        // keys, so hover and keyboard focus cannot drift apart.
        tone === 'danger'
          ? 'text-danger-700 data-highlighted:bg-danger-50'
          : 'text-ink data-highlighted:bg-inset',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
      )}
    >
      <Icon name={icon} className={tone === 'danger' ? 'text-danger-600' : 'text-ink-muted'} />
      <span data-part="menu-item-label" className="flex-1 truncate text-start">
        {children}
      </span>
      {trailing}
    </DropdownMenuPrimitive.Item>
  );
}

export function MenuLabel({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <DropdownMenuPrimitive.Label
      data-part="menu-label"
      className="px-3 pb-1 pt-2 text-meta font-medium text-ink-subtle"
    >
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export function MenuSeparator(): JSX.Element {
  return (
    <DropdownMenuPrimitive.Separator data-part="menu-separator" className="my-1.5 h-px bg-line" />
  );
}

export interface RowMenuProps {
  /** Named for screen readers; the trigger is a glyph. */
  readonly label: string;
  readonly children: ReactNode;
}

export function RowMenu({ label, children }: RowMenuProps): JSX.Element {
  return (
    <Menu>
      <MenuTrigger
        data-part="row-menu-trigger"
        aria-label={label}
        className={cn(
          'inline-grid size-(--control-h) shrink-0 cursor-pointer place-items-center',
          'lg:size-(--control-h-sm) rounded-control border border-line bg-surface text-ink-muted',
          'transition-colors duration-[250ms] ease-in-out',
          'hover:bg-inset hover:border-primary-600 hover:text-primary-600',
          'data-[state=open]:border-primary-600 data-[state=open]:text-primary-600',
        )}
      >
        <Icon name="more-vertical" className="size-4" />
      </MenuTrigger>

      <MenuContent>{children}</MenuContent>
    </Menu>
  );
}
