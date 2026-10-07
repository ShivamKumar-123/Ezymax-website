"use client";

// A9 risk preview before following (GET masters/{id}/preview): the worst case the follower's own protection allows,
// what the master's worst drawdown so far would mean for this amount, the risk score and the last trades re-sized.

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { Chip, Skeleton,  cn } from "@/components/kit";
// engine symbols include Kalks FX Options series codes, which @kalks/ui SymbolAvatar / SymbolCell (static list) throw on
import { TradeSymbolAvatar as SymbolAvatar, symbolLabel } from "@/components/trading/instrument";
import { Trans, useT } from "@kalks/i18n/react";
import { usd, useSocial, type RiskPreview, type SizingMode } from "./api";
import { RiskBadge } from "./bits";

const n2 = (v: number) => String(Math.round(v * 100) / 100);

export function RiskPreviewBox({
  masterId,
  allocation,
  equityStop,
  maxDdPct,
  mode,
  value,
  invite,
  examples = true,
}: {
  masterId: number;
  allocation: number;
  equityStop: number | null;
  maxDdPct: number | null;
  mode: SizingMode;
  value: number;
  invite?: string | null;
  examples?: boolean;
}) {
  const t = useT();
  const [path, setPath] = React.useState<string | null>(null);

  // debounced: a new preview only once the amount and limits stop changing
  React.useEffect(() => {
    if (!(allocation > 0) || allocation > 1e9) {
      setPath(null);
      return;
    }
    const timer = setTimeout(() => {
      const p = new URLSearchParams({ allocation: n2(allocation), sizing: mode });
      if (equityStop !== null && equityStop > 0 && equityStop < allocation) p.set("equityStop", n2(equityStop));
      if (maxDdPct !== null && maxDdPct >= 1 && maxDdPct <= 99) p.set("maxDdPct", n2(maxDdPct));
      if (mode !== "equity" && value > 0 && value <= 1e9) p.set("value", n2(value));
      if (invite) p.set("invite", invite);
      setPath(`masters/${masterId}/preview?${p}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [masterId, allocation, equityStop, maxDdPct, mode, value, invite]);

  const { data, error } = useSocial<RiskPreview>(path);
  const p = data && path ? data : null;

  return (
    <section aria-label={t("social.follow.preview.title")} className="rounded-[16px] border border-down/25 bg-down-soft px-4 py-3" data-testid="copy-risk-preview">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
          <ShieldAlert className="size-4 text-down" /> {t("social.follow.preview.title")}
        </span>
        {p && <RiskBadge risk={p.master.riskScore} showLabel />}
      </div>
      {!p ? (
        error && path ? (
          <p className="text-[12px] text-fg-3">{t("social.follow.preview.unavailable")}</p>
        ) : (
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )
      ) : (
        <div className="space-y-1.5 text-[12.5px] leading-relaxed text-fg-2">
          <p className="text-[13.5px]">
            <Trans
              k="social.follow.preview.worst"
              vars={{ loss: usd(-p.worstCase.loss), pct: Math.round(p.worstCase.pctOfAllocation * 10) / 10 }}
              tags={{ b: (c) => <b className="k-num font-semibold text-down">{c}</b> }}
            />
          </p>
          <p className="text-fg-3">{t.dyn(`social.follow.preview.basis.${p.worstCase.basis}`, "")}</p>
          <p>
            {p.master.maxDdPct > 0
              ? t("social.follow.preview.masterDd", { dd: Math.round(p.master.maxDdPct * 10) / 10, loss: usd(-p.master.lossAtMaxDd) })
              : t("social.follow.preview.noDd")}
          </p>
          {examples && p.example.length > 0 && (
            <div className="pt-1.5">
              <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-fg-3">{t("social.follow.preview.examples")}</div>
              <ul className="space-y-1">
                {p.example.slice(0, 5).map((x, i) => (
                  <li key={`${x.closeTime}-${i}`} className="flex items-center gap-2 text-[12px]">
                    <SymbolAvatar symbol={x.symbol} size={16} />
                    <span className="min-w-16 max-w-44 truncate font-medium text-fg" title={x.symbol}>
                      {symbolLabel(t, x.symbol)}
                    </span>
                    <Chip size="sm" tone={x.side === "buy" ? "up" : "down"}>
                      {t.dyn(`common.${x.side}`, x.side).toUpperCase()}
                    </Chip>
                    <span className="k-num text-fg-3">
                      {Number(x.masterVolume).toFixed(2)} → {x.skipped || x.yourVolume === null ? t("social.follow.preview.skipped") : Number(x.yourVolume).toFixed(2)}
                    </span>
                    <span className={cn("k-num ms-auto font-medium", (x.yourProfit ?? 0) > 0 ? "text-up" : (x.yourProfit ?? 0) < 0 ? "text-down" : "text-fg-3")}>
                      {x.yourProfit !== null && !x.skipped ? usd(x.yourProfit, 2, true) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="pt-1 text-[11.5px] text-fg-3">{t("social.follow.preview.note")}</p>
        </div>
      )}
    </section>
  );
}
