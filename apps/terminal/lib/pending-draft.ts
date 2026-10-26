"use client";

// The pending order the ticket is filling in, shared with the chart so it can be placed by eye.
//
// An order that exists is a line on the chart you can drag (components/chart/trade-overlay.tsx). One you are still
// typing was invisible: the trader picked Buy Limit, read a price off the chart and typed it into the ticket, which
// is the one part of placing a pending order that the chart was no help with.
//
// So the ticket publishes what it currently has - market, side, kind, price, lot - and the chart draws it as a line
// like any other, dashed because nothing has been sent. Dragging that line writes the price back here and the ticket
// picks it up, which is the same loop the real order lines use, with the ticket standing in for the server.
//
// It is session state, not a preference: nothing is stored, and it is cleared the moment the ticket stops offering a
// pending order (sent, switched to Market, another market, the panel closed). Deliberately dependency-free so both
// the ticket and the chart can read it without either importing the other.
import * as React from "react";

import type { OrderType } from "./trading";

export interface PendingDraft {
  symbol: string;
  /** null until the trader has chosen Sell or Buy: the line is drawn, its direction is not decided */
  side: "buy" | "sell" | null;
  kind: Exclude<OrderType, "market">;
  /** the entry price in the ticket, or null while the field is empty */
  price: number | null;
  /** lots, for the line's label */
  volume: number;
}

const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((f) => f());

let draft: PendingDraft | null = null;
/** Set by the chart when a drag moves the line; the ticket reads it and puts the price in its own field. */
let dragged: { at: number; price: number } | null = null;

export const pendingDraft = () => draft;

/** The ticket publishes what it is holding. Passing null clears the line. */
export function setPendingDraft(d: PendingDraft | null) {
  const same =
    (d === null && draft === null) ||
    (d !== null && draft !== null && d.symbol === draft.symbol && d.side === draft.side && d.kind === draft.kind && d.price === draft.price && d.volume === draft.volume);
  if (same) return;
  draft = d;
  emit();
}

/**
 * The chart moved the line. The price is kept here rather than pushed into the ticket directly, so the ticket stays
 * the owner of its own field: it reads this on the next render and formats the figure its own way.
 */
export function dragPendingDraft(price: number) {
  if (!draft) return;
  dragged = { at: Date.now(), price };
  draft = { ...draft, price };
  emit();
}

/** The last price a drag produced, once. Returns null when the ticket has already taken it. */
export function takeDraggedPrice(): number | null {
  const d = dragged;
  dragged = null;
  return d ? d.price : null;
}

function subscribe(onChange: () => void) {
  subscribers.add(onChange);
  return () => void subscribers.delete(onChange);
}

/** Re-renders when the ticket's pending order changes (null on the server render). */
export function usePendingDraft(): PendingDraft | null {
  return React.useSyncExternalStore(subscribe, pendingDraft, () => null);
}
