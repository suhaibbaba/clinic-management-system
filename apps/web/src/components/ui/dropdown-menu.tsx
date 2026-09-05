import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { JSX, ReactNode } from 'react';

import { Icon, type IconName } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

/**
 * The app's dropdown menu, over Radix.
 *
 * Radix is already the source of the dialog, toast and switch here, and a menu
 * is the component least worth hand-rolling: roving focus, typeahead, escape
 * and outside-click, `aria-expanded` on the trigger, focus returned to it on
 * close, and portalling so the panel is not clipped by a scrolling header.
 *
 * `dir` is read off the document rather than hardcoded, so `side`/`align` and
 * the arrow keys mirror when the language changes. Radix reads it from the
 * `Root` and passes it down through the portal, which a CSS-only approach
 * cannot do — the panel renders on `document.body`, outside any `dir` wrapper.
 */

/**
 * `dir` belongs on the root, not the content: Radix passes it down through the
 * portal, which is the only way the panel gets it — the panel renders on
 * `document.body`, outside any `dir` wrapper in the tree.
 */
export function DropdownMenu({ children }: { readonly children: ReactNode }): JSX.Element {
  const dir =
    typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';

  return <DropdownMenuPrimitive.Root dir={dir}>{children}</DropdownMenuPrimitive.Root>;
}

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
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
        align={align}
        sideOffset={8}
        className={cn(
          'z-50 min-w-56 rounded-panel bg-surface p-1.5 shadow-float',
          // 150ms fade + scale out of the corner the menu actually opened
          // from, rather than appearing from nowhere. Radix computes that
          // origin and hands it over as a custom property.
          'origin-(--radix-dropdown-menu-content-transform-origin)',
          'data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out',
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps {
  readonly icon: IconName;
  readonly children: ReactNode;
  readonly onSelect?: (() => void) | undefined;
  /** Sign-out and deletions: the same red the rest of the app uses for danger. */
  readonly tone?: 'default' | 'danger' | undefined;
  /** Shown at the end of the row — a checkmark, a shortcut, a current value. */
  readonly trailing?: ReactNode | undefined;
}

export function DropdownMenuItem({
  icon,
  children,
  onSelect,
  tone = 'default',
  trailing,
}: DropdownMenuItemProps): JSX.Element {
  return (
    <DropdownMenuPrimitive.Item
      {...(onSelect && { onSelect })}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-control px-3 py-2',
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
      <span className="flex-1 truncate text-start">{children}</span>
      {trailing}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <DropdownMenuPrimitive.Label className="px-3 pb-1 pt-2 text-label font-medium text-ink-subtle">
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export function DropdownMenuSeparator(): JSX.Element {
  return <DropdownMenuPrimitive.Separator className="my-1.5 h-px bg-line" />;
}
