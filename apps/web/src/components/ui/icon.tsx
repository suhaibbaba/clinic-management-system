import {
  GripVertical,
  ListOrdered,
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  Copy,
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
  Package,
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

// One size and stroke for every icon, or the set drifts one call site at a time. Names go through
// `IconName` so swapping the set is one file; nothing is mirrored automatically.
export type IconName =
  | 'activity'
  | 'alert'
  | 'bell'
  | 'building'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-end'
  | 'chevron-start'
  | 'clipboard'
  | 'clock'
  | 'coins'
  | 'copy'
  | 'edit'
  | 'error'
  | 'file'
  | 'gear'
  | 'grip'
  | 'globe'
  | 'image'
  | 'info'
  | 'language'
  | 'list'
  | 'login'
  | 'logout'
  | 'mail'
  | 'menu'
  | 'money'
  | 'package'
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
  building: Building2,
  calendar: CalendarDays,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  // Resolved per direction below — these are the LTR defaults.
  'chevron-end': ChevronRight,
  'chevron-start': ChevronLeft,
  clipboard: ClipboardList,
  clock: Clock,
  coins: Coins,
  copy: Copy,
  edit: Pencil,
  error: XCircle,
  file: FileText,
  gear: Settings,
  grip: GripVertical,
  globe: Globe,
  image: ImageIcon,
  info: Info,
  language: Languages,
  list: ListOrdered,
  login: LogIn,
  logout: LogOut,
  mail: Mail,
  menu: Menu,
  money: CreditCard,
  package: Package,
  phone: Phone,
  plus: Plus,
  print: Printer,
  key: KeyRound,
  reset: RotateCcw,
  search: Search,
  shield: Shield,
  spinner: Loader2,
  stethoscope: Stethoscope,
  // Lucide has no tooth and a dental app needs one; drawn on the same 24px grid so it sits at the
  // same weight.
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

// "Forward" points left in Arabic, so these cannot be fixed glyphs. Read from the document: an icon
// renders far from any provider.
const DIRECTIONAL: Partial<
  Record<IconName, { readonly rtl: LucideIcon; readonly ltr: LucideIcon }>
> = {
  'chevron-end': { rtl: ChevronLeft, ltr: ChevronRight },
  'chevron-start': { rtl: ChevronRight, ltr: ChevronLeft },
};

// An arrow through a doorway is a direction and lucide ships no mirrored twin, so these flip. A
// magnifier or a printer is an object and stays as drawn.
const MIRRORED: ReadonlySet<IconName> = new Set(['login', 'logout']);

export interface IconProps {
  readonly name: IconName;
  // 18px covers buttons, menus and inputs; 20px is for a lone icon holding its own. There is
  // deliberately no third size.
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
      className={cn(
        'shrink-0',
        size === 'md' ? 'size-5' : 'size-[18px]',
        isRtl && MIRRORED.has(name) && '-scale-x-100',
        className,
      )}
    />
  );
}
