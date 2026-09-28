"use client";

import * as React from "react";
import {
  BanknoteArrowUp,
  Banknote,
  BarChart3,
  BellRing,
  BookOpen,
  Bot,
  CalendarDays,
  ChartCandlestick,
  CircleCheck,
  Coins,
  CreditCard,
  Crown,
  Flame,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  HandCoins,
  Handshake,
  Hourglass,
  IdCard,
  KeyRound,
  Landmark,
  Laptop,
  Lightbulb,
  Link2,
  Lock,
  Medal,
  MessageCircle,
  Package,
  PartyPopper,
  Receipt,
  Rocket,
  SatelliteDish,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";

export type AnimIconTone = "ember" | "gold" | "up" | "down" | "info" | "warn";
export type AnimIconMotion = "float" | "lift" | "swing" | "bounce" | "pulse" | "flip" | "spin" | "wiggle" | "none";

interface Spec {
  icon: LucideIcon;
  tone: AnimIconTone;
  motion: AnimIconMotion;
}

/** Icon catalogue. Keys keep the old 3D-illustration names, so existing `name="…"` props (and mock data) keep working. */
export const ANIM_ICONS: Record<string, Spec> = {
  coin: { icon: Coins, tone: "gold", motion: "bounce" },
  money_bag: { icon: HandCoins, tone: "gold", motion: "bounce" },
  money_with_wings: { icon: BanknoteArrowUp, tone: "up", motion: "lift" },
  dollar_banknote: { icon: Banknote, tone: "gold", motion: "float" },
  bank: { icon: Landmark, tone: "gold", motion: "pulse" },
  credit_card: { icon: CreditCard, tone: "info", motion: "float" },
  receipt: { icon: Receipt, tone: "info", motion: "float" },
  rocket: { icon: Rocket, tone: "ember", motion: "lift" },
  fire: { icon: Flame, tone: "ember", motion: "wiggle" },
  sparkles: { icon: Sparkles, tone: "gold", motion: "pulse" },
  party_popper: { icon: PartyPopper, tone: "ember", motion: "wiggle" },
  trophy: { icon: Trophy, tone: "gold", motion: "float" },
  "1st_place_medal": { icon: Medal, tone: "gold", motion: "swing" },
  crown: { icon: Crown, tone: "gold", motion: "float" },
  gem_stone: { icon: Gem, tone: "ember", motion: "float" },
  shield: { icon: ShieldCheck, tone: "up", motion: "pulse" },
  locked: { icon: Lock, tone: "info", motion: "wiggle" },
  key: { icon: KeyRound, tone: "gold", motion: "wiggle" },
  identification_card: { icon: IdCard, tone: "info", motion: "float" },
  check_mark_button: { icon: CircleCheck, tone: "up", motion: "pulse" },
  warning: { icon: TriangleAlert, tone: "warn", motion: "pulse" },
  hourglass_not_done: { icon: Hourglass, tone: "warn", motion: "flip" },
  bell: { icon: BellRing, tone: "ember", motion: "swing" },
  calendar: { icon: CalendarDays, tone: "info", motion: "float" },
  satellite_antenna: { icon: SatelliteDish, tone: "info", motion: "wiggle" },
  robot: { icon: Bot, tone: "ember", motion: "float" },
  light_bulb: { icon: Lightbulb, tone: "gold", motion: "pulse" },
  graduation_cap: { icon: GraduationCap, tone: "info", motion: "float" },
  books: { icon: BookOpen, tone: "info", motion: "float" },
  speech_balloon: { icon: MessageCircle, tone: "info", motion: "wiggle" },
  magnifying_glass_tilted_left: { icon: Search, tone: "info", motion: "wiggle" },
  handshake: { icon: Handshake, tone: "gold", motion: "float" },
  busts_in_silhouette: { icon: Users, tone: "info", motion: "float" },
  package: { icon: Package, tone: "info", motion: "float" },
  wrapped_gift: { icon: Gift, tone: "ember", motion: "bounce" },
  bar_chart: { icon: BarChart3, tone: "up", motion: "float" },
  chart_increasing: { icon: TrendingUp, tone: "up", motion: "lift" },
  chart_decreasing: { icon: TrendingDown, tone: "down", motion: "float" },
  chart_increasing_with_yen: { icon: ChartCandlestick, tone: "up", motion: "float" },
  globe_with_meridians: { icon: Globe, tone: "info", motion: "spin" },
  gear: { icon: Settings, tone: "info", motion: "spin" },
  link: { icon: Link2, tone: "info", motion: "wiggle" },
  laptop: { icon: Laptop, tone: "info", motion: "float" },
  mobile_phone: { icon: Smartphone, tone: "info", motion: "wiggle" },
};

const TONE_VAR: Record<AnimIconTone, string> = {
  ember: "var(--k-ember)",
  gold: "var(--k-gold)",
  up: "var(--k-up)",
  down: "var(--k-down)",
  info: "var(--k-info)",
  warn: "var(--k-warn)",
};

/**
 * Kalks icon tile: a crisp line icon on a quiet tinted tile with a hairline border.
 * Deliberately static (no blur, glow or motion). `motion`/`idle` props are accepted for compatibility and ignored.
 */
export function AnimIcon({
  name,
  icon,
  size = 64,
  tone,
  motion,
  idle = "always",
  className,
  title,
}: {
  name?: string;
  icon?: LucideIcon;
  size?: number;
  tone?: AnimIconTone;
  motion?: AnimIconMotion;
  idle?: "always" | "hover";
  className?: string;
  title?: string;
}) {
  const spec = (name && ANIM_ICONS[name]) || { icon: Sparkles, tone: "ember" as const, motion: "pulse" as const };
  const Icon = icon ?? spec.icon;
  const t = tone ?? spec.tone;
  const m = motion ?? spec.motion;
  const radius = Math.round(size * 0.3);
  return (
    <span
      className={cn("anim-icon", className)}
            role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ width: size, height: size, borderRadius: radius, ["--ai-c" as string]: TONE_VAR[t] }}
    >
      <Icon size={Math.round(size * 0.44)} strokeWidth={size >= 48 ? 1.5 : 1.8} />
    </span>
  );
}

/** Just the line glyph for an icon name (no tile) — for places that already have their own container. */
export function IconGlyph({ name, className, strokeWidth = 1.8 }: { name: string; className?: string; strokeWidth?: number }) {
  const Icon = ANIM_ICONS[name]?.icon ?? Sparkles;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
