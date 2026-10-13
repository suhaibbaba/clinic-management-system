import type { SiteIcon as SiteIconName } from "@clinic/shared";
import {
  Armchair,
  ArrowLeft,
  Award,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Gem,
  Heart,
  Mail,
  MapPin,
  Menu,
  Monitor,
  Navigation,
  Phone,
  Play,
  Quote,
  Send,
  Shield,
  Smile,
  Sparkles,
  Star,
  Target,
  Stethoscope,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { JSX } from "react";
import { ToothGlyph } from "@web/site/components/tooth-glyph";
import { cx } from "@web/booking/ui";

type UiIcon =
  | "arrow-end"
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
  quote: Quote,
  x: X,
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
