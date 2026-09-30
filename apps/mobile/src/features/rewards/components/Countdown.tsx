// Time left until a contest ends (or starts): "2d 04:12:09". A leaf: only this text re-renders, once a second
// while under a day, once a minute before that. Time text, not animation.
import * as React from "react";
import { Mono, type Tone } from "@/ui";
import { useT } from "@/i18n";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ to, size = 15, color, tone, onEnd }: { to: string; size?: number; color?: string; tone?: Tone; onEnd?: () => void }) {
  const t = useT();
  const end = React.useMemo(() => Date.parse(to), [to]);
  const [now, setNow] = React.useState(() => Date.now());
  const left = end - now;
  const underDay = left < 86_400_000;
  React.useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setNow(Date.now()), underDay ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [underDay, left <= 0]);
  const ended = React.useRef(false);
  React.useEffect(() => {
    if (left <= 0 && !ended.current) {
      ended.current = true;
      onEnd?.();
    }
  }, [left, onEnd]);
  const p = parts(left);
  const pad = (v: number) => String(v).padStart(2, "0");
  const text = underDay ? `${pad(p.h)}:${pad(p.m)}:${pad(p.s)}` : `${t("mobileRewards.countdown.days", { d: p.d })} ${pad(p.h)}:${pad(p.m)}`;
  return (
    <Mono size={size} weight="bold" color={color} tone={tone} accessibilityLabel={t("mobileRewards.countdown.a11y", { d: p.d, h: p.h, m: p.m })} style={{ writingDirection: "ltr" }}>
      {text}
    </Mono>
  );
}
