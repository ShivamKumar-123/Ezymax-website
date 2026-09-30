// The depth-of-market ladder on Skia, MT5 / cTrader style: asks above the spread row (best ask next to it), bids
// below (best bid next to it), the price centred (asks red, bids green: the two sides), the lots beside it with a
// bar growing outwards with the size, the client's own pending orders tagged at their level, and the spread and
// mid in the middle row. The whole ladder is one picture recorded on the UI thread from the book's shared value:
// a tick redraws it without touching React. Taps are handled by static rows laid over it (DepthScreen).
import * as React from "react";
import { Canvas, Picture, Skia, createPicture, useFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";
import { LEVELS } from "./book";
import { EDGE, LADDER_H, PRICE_W, ROW_H, ROWS } from "./layout";

const MONO_MEDIUM = require("@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf");
const MONO = require("@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf");

/** Own pending orders by kind (buy limit, sell limit, buy stop, sell stop): Latin, like MT5, so the mono face can draw
 *  them in every language. */
const TAGS = ["BL", "SL", "BS", "SS"];
/** Lots bars: the side's money colour, faint (tokens, so they follow the palette). */
const ASK_BAR = alpha(colors.down, 0.2);
const BID_BAR = alpha(colors.up, 0.2);

export type LadderProps = {
  width: number;
  book: SharedValue<number[]>;
  /** the client's pending orders on the symbol: [price, kind (0 buy limit, 1 sell limit, 2 buy stop, 3 sell stop), lots]… */
  mine: SharedValue<number[]>;
  digits: number;
  rtl: boolean;
};

/** Only digits and Latin letters are drawn here (the mono face has no Arabic, Devanagari…); the words of the spread
 *  row are laid over the canvas in React (DepthScreen). */
export function Ladder({ width, book, mine, digits, rtl }: LadderProps) {
  const priceFont = useFont(MONO_MEDIUM, 15);
  const sizeFont = useFont(MONO, 12.5);
  const tagFont = useFont(MONO_MEDIUM, 9.5);
  const point = Math.pow(10, -digits);
  const picture = useDerivedValue(
    () => {
      const b = book.value;
      const m = mine.value;
      return createPicture(
        (canvas) => {
          if (!priceFont || !sizeFont || !tagFont || width <= 0) return;
          const W = width;
          const cx = W / 2;
          const half = PRICE_W / 2;
          const sideW = cx - half;
          // the box [x, x + w] in the reading direction (mirrored for right-to-left)
          const X = (x: number, w: number) => (rtl ? W - x - w : x);
          const paint = (c: string) => {
            const p = Skia.Paint();
            p.setColor(Skia.Color(c));
            p.setAntiAlias(true);
            return p;
          };
          const askText = paint(colors.down);
          const bidText = paint(colors.up);
          const sizeText = paint(colors.text2);
          const dim = paint(colors.text3);
          const askBar = paint(ASK_BAR);
          const bidBar = paint(BID_BAR);
          const best = paint(colors.surface);
          const line = paint(colors.line);
          const spreadBg = paint(colors.bgRaised);
          const tagBg = paint(colors.gold);
          const tagInk = paint(colors.ink);

          let max = 0;
          for (let i = 1; i < b.length; i += 2) if (b[i]! > max) max = b[i]!;

          // spread row
          const sy = LEVELS * ROW_H;
          canvas.drawRect(Skia.XYWHRect(0, sy, W, ROW_H), spreadBg);
          canvas.drawRect(Skia.XYWHRect(0, sy, W, 1), line);
          canvas.drawRect(Skia.XYWHRect(0, sy + ROW_H - 1, W, 1), line);
          const bestBid = b[0]!;
          const bestAsk = b[LEVELS * 2]!;
          if (bestBid > 0 && bestAsk > 0) {
            // spread in points at the inner edge of the start column, the mid price in the price column
            const pts = String(Math.round((bestAsk - bestBid) / point));
            const pw = sizeFont.getTextWidth(pts);
            canvas.drawText(pts, X(cx - half - 10 - pw, pw), sy + ROW_H / 2 + 4.5, sizeText, sizeFont);
            const mt = ((bestBid + bestAsk) / 2).toFixed(digits);
            const mw = sizeFont.getTextWidth(mt);
            canvas.drawText(mt, X(cx - mw / 2, mw), sy + ROW_H / 2 + 4.5, dim, sizeFont);
          }

          // price of each row (0 = none; the spread row has none)
          const rowPrice: number[] = [];
          for (let r = 0; r < ROWS; r++) {
            if (r === LEVELS) {
              rowPrice.push(0);
              continue;
            }
            const ask = r < LEVELS;
            const k = ask ? LEVELS - 1 - r : r - LEVELS - 1;
            rowPrice.push(b[(ask ? LEVELS * 2 : 0) + k * 2]! || 0);
          }
          // the client's pending orders: each on the row nearest its price, within half a level step
          const levelStep = bestBid > 0 && b[2]! > 0 ? Math.abs(bestBid - b[2]!) : point;
          const rowOrder: number[] = [];
          for (let r = 0; r < ROWS; r++) rowOrder.push(-1);
          for (let j = 0; j + 2 < m.length; j += 3) {
            let near = -1;
            let dist = Infinity;
            for (let r = 0; r < ROWS; r++) {
              const rp = rowPrice[r]!;
              if (!(rp > 0)) continue;
              const d = Math.abs(rp - m[j]!);
              if (d < dist) {
                dist = d;
                near = r;
              }
            }
            if (near >= 0 && dist <= levelStep / 2 + point / 2 && rowOrder[near] === -1) rowOrder[near] = j;
          }

          for (let r = 0; r < ROWS; r++) {
            if (r === LEVELS) continue;
            const ask = r < LEVELS;
            const k = ask ? LEVELS - 1 - r : r - LEVELS - 1;
            const off = (ask ? LEVELS * 2 : 0) + k * 2;
            const p = b[off]!;
            const s = b[off + 1]!;
            if (!(p > 0)) continue;
            const y = r * ROW_H;
            const mid = y + ROW_H / 2;
            if (k === 0) canvas.drawRect(Skia.XYWHRect(0, y, W, ROW_H), best);
            canvas.drawRect(Skia.XYWHRect(0, ask ? y + ROW_H - 0.5 : y, W, 0.5), line);
            // lots bar, growing outwards from the price column
            if (s > 0 && max > 0) {
              const bw = Math.max(3, (s / max) * (sideW - 12));
              const bx = ask ? cx + half : cx - half - bw;
              canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(X(bx, bw), y + 8, bw, ROW_H - 16), 4, 4), ask ? askBar : bidBar);
            }
            // price
            const pt = p.toFixed(digits);
            const pw = priceFont.getTextWidth(pt);
            canvas.drawText(pt, X(cx - pw / 2, pw), mid + 5.5, ask ? askText : bidText, priceFont);
            // lots, at the outer edge (the bar passes under it when it is long)
            const st = s.toFixed(2);
            const sw = sizeFont.getTextWidth(st);
            const sx = ask ? W - EDGE - sw : EDGE;
            canvas.drawText(st, X(sx, sw), mid + 4.5, sizeText, sizeFont);
            // the client's own pending order at (or nearest to) this level, next to the price
            const j = rowOrder[r]!;
            if (j >= 0) {
              const tag = `${TAGS[m[j + 1]!] ?? ""} ${m[j + 2]!.toFixed(2)}`;
              const tw = tagFont.getTextWidth(tag) + 12;
              const tx = ask ? cx + half + 6 : cx - half - 6 - tw;
              canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(X(tx, tw), mid - 10, tw, 20), 5, 5), tagBg);
              canvas.drawText(tag, X(tx + 6, tw - 12), mid + 3.5, tagInk, tagFont);
            }
          }
        },
        Skia.XYWHRect(0, 0, width, LADDER_H),
      );
    },
    [width, digits, rtl, point, priceFont, sizeFont, tagFont],
  );
  return (
    <Canvas style={{ width, height: LADDER_H }} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
