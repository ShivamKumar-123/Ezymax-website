import { ImageResponse } from "next/og";
import type { PublicShare } from "@/lib/growth";

// Share P&L card PNG (1200 × 630, OpenGraph size) in the Kalks certificate style (lib/prop-cert-image.tsx):
// dark page, card with an ember top bar and the KALKS wordmark. Money is drawn only when data.profit is set
// (the client opted in to showing amounts).

const BG = "#0b0b0d";
const CARD = "#121215";
const LINE = "#2a2a30";
const FG = "#f5f5f6";
const FG2 = "#c4c4cc";
const FG3 = "#9a9aa3";
const EMBER = "#ff5a1f";
const UP = "#22c55e";
const DOWN = "#f04438";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function day(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function price(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const digits = v >= 1000 ? 2 : v >= 50 ? 3 : 5;
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function pct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(2)}%`;
}

function money(v: number, currency: string) {
  const cur = currency === "USD" ? "$" : currency === "USC" ? "USC " : `${currency} `;
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}${cur}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const tone = (v: number | null | undefined) => (v === null || v === undefined || v === 0 ? FG : v > 0 ? UP : DOWN);

function Stat({ label, value, color = FG }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 64 }}>
      <span style={{ fontSize: 17, color: FG3, letterSpacing: 1 }}>{label.toUpperCase()}</span>
      <span style={{ fontSize: 30, fontWeight: 600, color, marginTop: 8 }}>{value}</span>
    </div>
  );
}

/** `link` = "host/r/CODE" (or just the host when the client has no referral code). */
export function shareImage(s: PublicShare, link: string): ImageResponse {
  const d = s.data;
  const trade = s.kind === "trade";
  const side = (d.side ?? "").toLowerCase();
  const big = trade ? d.movePct : d.returnPct;
  const title = trade ? (d.symbol ?? "Trade") : "Trading results";
  const sub = trade ? [day(d.openTime), day(d.closeTime)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" – ") : [day(d.from), day(d.to)].filter(Boolean).join(" – ");

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: BG, padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", background: CARD, border: `1px solid ${LINE}`, borderRadius: 28, overflow: "hidden", padding: "0 56px" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: EMBER }} />

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 46 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: FG, letterSpacing: 1 }}>KALKS</span>
              <span style={{ fontSize: 18, color: FG3, marginLeft: 14 }}>{trade ? "TRADE" : "RESULTS"}</span>
            </div>
            <span style={{ fontSize: 18, color: FG3 }}>{d.name}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 44 }}>
            <span style={{ fontSize: 48, fontWeight: 600, color: FG }}>{title}</span>
            {trade && (side === "buy" || side === "sell") && (
              <span
                style={{
                  display: "flex",
                  marginLeft: 20,
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: side === "buy" ? UP : DOWN,
                  background: side === "buy" ? "rgba(34,197,94,0.12)" : "rgba(240,68,56,0.12)",
                  border: `1px solid ${side === "buy" ? "rgba(34,197,94,0.35)" : "rgba(240,68,56,0.35)"}`,
                }}
              >
                {side.toUpperCase()}
              </span>
            )}
            {sub && <span style={{ fontSize: 20, color: FG3, marginLeft: "auto" }}>{sub}</span>}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 18 }}>
            <span style={{ fontSize: 120, fontWeight: 700, color: tone(big), lineHeight: 1, letterSpacing: -2 }}>{pct(big)}</span>
            <span style={{ fontSize: 22, color: FG3, marginLeft: 20, marginBottom: 14 }}>{trade ? "price move" : "return"}</span>
            {d.profit !== null && d.profit !== undefined && <span style={{ fontSize: 40, fontWeight: 600, color: tone(d.profit), marginLeft: "auto", marginBottom: 8 }}>{money(d.profit, d.currency || "USD")}</span>}
          </div>

          <div style={{ display: "flex", marginTop: 34 }}>
            {trade ? (
              <>
                <Stat label="Open" value={price(d.openPrice)} />
                <Stat label="Close" value={price(d.closePrice)} />
                {d.lots !== null && d.lots !== undefined && <Stat label="Lots" value={d.lots.toFixed(2)} />}
              </>
            ) : (
              <>
                <Stat label="Trades" value={d.trades !== null && d.trades !== undefined ? d.trades.toLocaleString("en-US") : "—"} />
                <Stat label="Win rate" value={d.winRate !== null && d.winRate !== undefined ? `${d.winRate.toFixed(1)}%` : "—"} />
                <Stat label="Lots" value={d.lots !== null && d.lots !== undefined ? d.lots.toFixed(2) : "—"} />
              </>
            )}
          </div>

          <div style={{ display: "flex", marginTop: "auto", borderTop: `1px solid ${LINE}`, paddingTop: 24, paddingBottom: 30, justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 22, color: FG2 }}>{`Join me on Kalks · ${link}`}</span>
            <span style={{ fontSize: 15, color: FG3 }}>Past performance is not indicative of future results</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
