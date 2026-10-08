import { ImageResponse } from "next/og";
import { optionStrikeLabel, type PublicShare, type ShareOption } from "@/lib/growth";

// Share P&L card PNG (1200 × 630, OpenGraph size) in the Ezymex certificate style (lib/prop-cert-image.tsx):
// dark page, card with an ember top bar and the EZYMEX wordmark. Money is drawn only when data.profit is set
// (the client opted in to showing amounts). An option trade gets its own layout: the contract, side, entry → exit
// premium per contract, the return on premium and a payoff sketch; never the account balance.

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

/* ------------------------------------------------------------------ */
/* Options share card (O36): contract, side, premiums, payoff sketch   */
/* ------------------------------------------------------------------ */

const INFO = "#4ea8ff";
const OPT_REASON: Record<string, string> = { closed: "Closed", expired: "Expiry", knocked_out: "Knock-out", stop_out: "Stop-out", sl: "Stop loss", tp: "Take profit" };

function usdPlain(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const strikeText = optionStrikeLabel;

type Pt = [number, number];

/**
 * The payoff at expiry per unit of the underlying for the client's side: a long call max(S − K, 0) − p, a long put
 * max(K − S, 0) − p, a short the negative. Sampled around the strike (wide enough for the breakeven and the
 * settlement); drawn as profit (green) and loss (red) areas over the zero line. No text inside the SVG (the image
 * renderer has no fonts there): the labels are drawn under it.
 */
function PayoffSketch({ o, width, height }: { o: ShareOption; width: number; height: number }) {
  const k = o.strike ?? 0;
  const p = Math.max(0, o.openPremiumUnit ?? (o.breakeven !== null && o.strike !== null ? Math.abs(o.breakeven - o.strike) : 0));
  const sign = (o.side ?? "buy").toLowerCase() === "sell" ? -1 : 1;
  const call = o.right !== "put";
  const f = (x: number) => sign * ((call ? Math.max(x - k, 0) : Math.max(k - x, 0)) - p);
  const settle = o.settle ?? null;
  const w = Math.max(p * 3, settle !== null ? Math.abs(settle - k) * 1.3 : 0, Math.abs(k) * 0.004, 1e-6);
  const x0 = k - w;
  const x1 = k + w;
  const xs = Array.from({ length: 61 }, (_, i) => x0 + ((x1 - x0) * i) / 60);
  for (const x of [k, k + (call ? p : -p)]) if (x > x0 && x < x1) xs.push(x);
  xs.sort((a, b) => a - b);
  const ys = xs.map(f);
  let lo = Math.min(0, ...ys);
  let hi = Math.max(0, ...ys);
  const pad = (hi - lo || 1) * 0.15;
  lo -= pad;
  hi += pad;
  const X = (x: number) => ((x - x0) / (x1 - x0)) * width;
  const Y = (y: number) => height - ((y - lo) / (hi - lo)) * height;
  const line: Pt[] = xs.map((x, i) => [X(x), Y(ys[i]!)]);
  const area = (clip: (y: number) => number): string => [[X(x0), Y(0)] as Pt, ...xs.map((x, i): Pt => [X(x), Y(clip(ys[i]!))]), [X(x1), Y(0)] as Pt].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  const sx = settle !== null && settle >= x0 && settle <= x1 ? settle : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={area((y) => Math.max(y, 0))} fill="rgba(34,197,94,0.22)" />
      <polygon points={area((y) => Math.min(y, 0))} fill="rgba(240,68,56,0.22)" />
      <line x1={0} y1={Y(0)} x2={width} y2={Y(0)} stroke={LINE} strokeWidth={2} />
      <line x1={X(k)} y1={0} x2={X(k)} y2={height} stroke={FG3} strokeWidth={2} strokeDasharray="6 6" />
      <polyline points={line.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")} fill="none" stroke={FG} strokeWidth={4} strokeLinejoin="round" />
      {sx !== null && <circle cx={X(sx)} cy={Y(f(sx))} r={9} fill={EMBER} stroke={CARD} strokeWidth={3} />}
    </svg>
  );
}

function optionImage(s: PublicShare, o: ShareOption, link: string): ImageResponse {
  const d = s.data;
  const side = (o.side ?? "buy").toLowerCase() === "sell" ? "sell" : "buy";
  const right = o.right === "put" ? "Put" : "Call";
  const title = `${o.underlying} ${strikeText(o)} ${right}`.trim();
  const big = o.pnlPct ?? d.movePct;
  const exp = o.expiry ? `Expiry ${day(o.expiry)}` : "";
  const labels = [
    o.strike !== null ? `Strike ${strikeText(o)}` : "",
    o.breakeven !== null ? `Breakeven ${price(o.breakeven)}` : "",
    o.settle !== null ? `${o.reason === "expired" ? "Settled" : "Closed"} at ${price(o.settle)}` : "",
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: BG, padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", background: CARD, border: `1px solid ${LINE}`, borderRadius: 28, overflow: "hidden", padding: "0 56px" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: EMBER }} />

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 42 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: FG, letterSpacing: 1 }}>EZYMEX</span>
              <span style={{ fontSize: 18, color: INFO, marginLeft: 14, letterSpacing: 1 }}>OPTION TRADE</span>
            </div>
            <span style={{ fontSize: 18, color: FG3 }}>{d.name}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 34 }}>
            <span style={{ fontSize: 46, fontWeight: 600, color: FG }}>{title}</span>
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
              {side === "buy" ? "BOUGHT" : "SOLD"}
            </span>
            {exp && <span style={{ fontSize: 20, color: FG3, marginLeft: "auto" }}>{exp}</span>}
          </div>

          <div style={{ display: "flex", marginTop: 22, flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <span style={{ fontSize: 100, fontWeight: 700, color: tone(big), lineHeight: 1, letterSpacing: -2 }}>{pct(big)}</span>
                <span style={{ fontSize: 22, color: FG3, marginLeft: 18, marginBottom: 12 }}>on premium</span>
              </div>
              <div style={{ display: "flex", marginTop: 28 }}>
                <Stat label="Entry / contract" value={usdPlain(o.entryPremium)} />
                <Stat label="Exit / contract" value={usdPlain(o.exitPremium)} />
                {d.profit !== null && d.profit !== undefined && <Stat label="P&L" value={money(d.profit, d.currency || "USD")} color={tone(d.profit)} />}
              </div>
              <div style={{ display: "flex", marginTop: 18 }}>
                <Stat label="Contracts" value={Number.isFinite(o.contracts) ? String(+o.contracts.toFixed(4)) : "—"} />
                <Stat label="Closed by" value={OPT_REASON[o.reason] ?? "Closed"} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: "auto", width: 420 }}>
              <span style={{ fontSize: 15, color: FG3, letterSpacing: 1 }}>PAYOFF AT EXPIRY</span>
              <div style={{ display: "flex", marginTop: 12, borderRadius: 16, border: `1px solid ${LINE}`, padding: 14, background: BG }}>
                <PayoffSketch o={o} width={390} height={170} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 10 }}>
                {labels.map((l) => (
                  <span key={l} style={{ fontSize: 15, color: FG2, marginRight: 18 }}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 18, borderTop: `1px solid ${LINE}`, paddingTop: 22, paddingBottom: 28, justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 22, color: FG2 }}>{`Join me on Ezymex · ${link}`}</span>
            <span style={{ fontSize: 14, color: FG3 }}>Options carry high risk · past performance is not indicative of future results</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

/** `link` = "host/r/CODE" (or just the host when the client has no referral code). */
export function shareImage(s: PublicShare, link: string): ImageResponse {
  const d = s.data;
  if (s.kind === "trade" && d.option) return optionImage(s, d.option, link);
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
              <span style={{ fontSize: 28, fontWeight: 700, color: FG, letterSpacing: 1 }}>EZYMEX</span>
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
            <span style={{ fontSize: 22, color: FG2 }}>{`Join me on Ezymex · ${link}`}</span>
            <span style={{ fontSize: 15, color: FG3 }}>Past performance is not indicative of future results</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
