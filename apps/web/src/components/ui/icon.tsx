import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  CreditCard,
  FileText,
  Globe,
  Image as ImageIcon,
  Info,
  KeyRound,
  Languages,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Stethoscope,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '@web/lib/cn';

/**
 * The app's icons: lucide, behind a wrapper that fixes size and stroke.
 *
 * The wrapper is the point. Lucide's own components take `size` and
 * `strokeWidth` per call site, which is exactly how an icon set drifts — one
 * screen at 16/2, the next at 20/1.5, and a toolbar where every glyph has a
 * different weight. Everything here is 18px at stroke 1.75 unless a caller
 * asks for the one larger step, so a row of icons reads as one family.
 *
 * Names are indirected through `IconName` rather than importing lucide at each
 * call site, so the vocabulary is a list one can read, swapping the icon set
 * again is one file, and no screen can quietly introduce a 400th glyph.
 *
 * Every icon is `currentColor` and decorative: an icon here never carries
 * meaning on its own, so it is `aria-hidden` and the label beside it is what a
 * screen reader announces. Where an icon is the only content — a circular
 * action button — the *button* carries the accessible name, not the glyph.
 *
 * Nothing is mirrored for RTL automatically. `chevron-start`/`chevron-end` are
 * named by reading order and resolve per direction at render; a bell is a bell.
 */
export type IconName =
  | 'activity'
  | 'alert'
  | 'bell'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-end'
  | 'chevron-start'
  | 'clipboard'
  | 'coins'
  | 'edit'
  | 'error'
  | 'file'
  | 'gear'
  | 'globe'
  | 'image'
  | 'info'
  | 'language'
  | 'login'
  | 'logout'
  | 'mail'
  | 'menu'
  | 'money'
  | 'phone'
  | 'plus'
  | 'print'
  | 'reset'
  | 'key'
  | 'search'
  | 'shield'
  | 'spinner'
  | 'stethoscope'
  | 'tooth'
  | 'trash'
  | 'trend-down'
  | 'trend-up'
  | 'upload'
  | 'user'
  | 'user-plus'
  | 'users'
  | 'x';

const ToothGlyph: LucideIcon = ((props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path
      d="M12 3.4c-4.1 0-6.7 2.5-6.7 6.2 0 3.4 1.7 5.4 2.5 8.7.5 1.7 1.8 2.1 2.6 1.2.8-.9.8-3.7 1.6-3.7s.8 2.8 1.6 3.7c.8.9 2.1.5 2.6-1.2.8-3.3 2.5-5.3 2.5-8.7 0-3.7-2.6-6.2-6.7-6.2Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)) as LucideIcon;

const ICONS: Record<IconName, LucideIcon> = {
  activity: Activity,
  alert: AlertTriangle,
  bell: Bell,
  calendar: CalendarDays,
  check: Check,
  'chevron-down': ChevronDown,
  // Resolved per direction below — these are the LTR defaults.
  'chevron-end': ChevronRight,
  'chevron-start': ChevronLeft,
  clipboard: ClipboardList,
  coins: Coins,
  edit: Pencil,
  error: XCircle,
  file: FileText,
  gear: Settings,
  globe: Globe,
  image: ImageIcon,
  info: Info,
  language: Languages,
  login: LogIn,
  logout: LogOut,
  mail: Mail,
  menu: Menu,
  money: CreditCard,
  phone: Phone,
  plus: Plus,
  print: Printer,
  key: KeyRound,
  reset: RotateCcw,
  search: Search,
  shield: Shield,
  spinner: Loader2,
  stethoscope: Stethoscope,
  // Lucide has no tooth, and a dental app needs one. Drawn on the same 24px
  // grid so it sits at the same weight as its neighbours; the stroke width and
  // colour come from the wrapper like every other glyph.
  tooth: ToothGlyph,
  trash: Trash2,
  'trend-down': TrendingDown,
  'trend-up': TrendingUp,
  upload: Upload,
  user: User,
  'user-plus': UserPlus,
  users: Users,
  x: X,
};

/**
 * Direction-relative chevrons.
 *
 * "Forward" is a left-pointing arrow in Arabic and a right-pointing one in
 * English, so these two cannot be fixed glyphs. Read from the document rather
 * than from a hook: an icon is rendered in tables and menus far from any
 * provider, and `dir` is set on `<html>` the moment the language changes.
 */
const DIRECTIONAL: Partial<
  Record<IconName, { readonly rtl: LucideIcon; readonly ltr: LucideIcon }>
> = {
  'chevron-end': { rtl: ChevronLeft, ltr: ChevronRight },
  'chevron-start': { rtl: ChevronRight, ltr: ChevronLeft },
};

export interface IconProps {
  readonly name: IconName;
  /**
   * `sm` (18px) is the default and covers buttons, menus and inputs. `md`
   * (20px) is for a lone icon that has to hold its own — a nav chip, an icon
   * button with no text. There is deliberately no third size.
   */
  readonly size?: 'sm' | 'md' | undefined;
  /** Sizing overrides and colour only — an icon has no colour of its own. */
  readonly className?: string | undefined;
}

export function Icon({ name, size = 'sm', className }: IconProps): JSX.Element {
  const directional = DIRECTIONAL[name];
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const Glyph = directional ? (isRtl ? directional.rtl : directional.ltr) : ICONS[name];

  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      strokeWidth={1.75}
      className={cn('shrink-0', size === 'md' ? 'size-5' : 'size-[18px]', className)}
    />
  );
}
