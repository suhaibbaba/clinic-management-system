import type { SiteIcon as SiteIconName } from "@clinic/shared";
import {
  Armchair,
  ArrowLeft,
  Award,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Files,
  Gem,
  Heart,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Monitor,
  Moon,
  Navigation,
  Phone,
  Pill,
  Play,
  Plus,
  Quote,
  Send,
  Shield,
  Smile,
  Sparkles,
  Star,
  Sun,
  Target,
  Stethoscope,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { JSX } from "react";
import { ToothGlyph } from "@web/site/components/tooth-glyph";
import { cx } from "@web/booking/ui";

type UiIcon =
  | "alert"
  | "arrow-end"
  | "calendar-clock"
  | "calendar-plus"
  | "dashboard"
  | "files"
  | "history"
  | "log-out"
  | "moon"
  | "pill"
  | "sun"
  | "wallet"
  | "check"
  | "chevron-down"
  | "chevron-start"
  | "chevron-end"
  | "user"
  | "directions"
  | "mail"
  | "map-pin"
  | "menu"
  | "phone"
  | "play"
  | "plus"
  | "quote"
  | "x";

const ICONS: Record<SiteIconName | UiIcon, LucideIcon> = {
  users: Users,
  sparkles: Sparkles,
  shield: Shield,
  heart: Heart,
  gem: Gem,
  smile: Smile,
  star: Star,
  award: Award,
  stethoscope: Stethoscope,
  clock: Clock,
  building: Building2,
  calendar: CalendarDays,
  eye: Eye,
  send: Send,
  monitor: Monitor,
  armchair: Armchair,
  target: Target,
  tooth: ToothGlyph,
  "arrow-end": ArrowLeft,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-start": ChevronRight,
  "chevron-end": ChevronLeft,
  user: User,
  directions: Navigation,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  phone: Phone,
  play: Play,
  plus: Plus,
  quote: Quote,
  x: X,
  alert: CircleAlert,
  "calendar-clock": CalendarClock,
  "calendar-plus": CalendarPlus,
  dashboard: LayoutDashboard,
  files: Files,
  history: History,
  "log-out": LogOut,
  moon: Moon,
  pill: Pill,
  sun: Sun,
  wallet: Wallet,
};

const MIRRORED = new Set<string>(["arrow-end", "chevron-start", "chevron-end"]);

export function SiteIcon({
  name,
  className,
}: {
  readonly name: SiteIconName | UiIcon;
  readonly className?: string;
}): JSX.Element {
  const Glyph = ICONS[name];

  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      strokeWidth={1.75}
      className={cx(
        "shrink-0",
        !className?.includes("size-") && "size-[18px]",
        MIRRORED.has(name) && "ltr:-scale-x-100",
        className,
      )}
    />
  );
}
