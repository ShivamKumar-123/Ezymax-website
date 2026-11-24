'use client';

/**
 * The running promotion, shown once to a visitor who lands on the site.
 *
 * Rules it keeps to, because a popup that breaks any of them costs more visitors than the offer wins:
 *  - it never appears before the page has settled (a dialog over a half-drawn hero reads as an ad network);
 *  - it goes away on Escape, on the backdrop, and on its own button, and says what it is in every one of them;
 *  - it is shown once, and again after three days only to someone who neither dismissed it nor acted on it;
 *  - it stops existing the moment the offer ends, without anyone having to deploy.
 *
 * Nothing about it is rendered on the server: the end date and what this visitor has already seen are both
 * only knowable in the browser, and rendering a guess first would flash the wrong thing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3, X } from 'lucide-react';
import { OFFER } from '@/content/offer';
import { LOGIN_HREF, REGISTER_HREF } from '@/lib/crm';

/** Long enough that the page is drawn and the visitor has started reading, short enough to still be seen. */
const DELAY_MS = 2200;

/** A visitor who ignored it once is asked again, but not the next morning. */
const REMIND_AFTER_MS = 3 * 24 * 3600 * 1000;

const KEY = `ezymex_offer:${OFFER.id}`;

type Seen = { at: number; done?: boolean };

/** What this browser remembers. Storage can be blocked or cleared, and then the answer is simply "not yet". */
function remembered(): Seen | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Seen | null;
    return v && typeof v.at === 'number' ? v : null;
  } catch {
    return null;
  }
}

function remember(v: Seen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: the popup simply shows again next time, which is the kinder failure */
  }
}

/** Whole days left, floored at one: the last afternoon still reads "1 day left", never "0". */
function daysLeft(endsAt: string): number | null {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export default function OfferPopup() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the fade, one frame after mounting
  const [days, setDays] = useState<number | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  const close = useCallback((done = false) => {
    setShown(false);
    remember({ at: Date.now(), done });
    // let the fade finish before the dialog leaves the tree
    window.setTimeout(() => setOpen(false), 200);
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus();
  }, []);

  useEffect(() => {
    const left = daysLeft(OFFER.endsAt);
    if (left === null) return; // the offer is over: there is nothing to show, now or later

    const seen = remembered();
    if (seen?.done) return;
    if (seen && Date.now() - seen.at < REMIND_AFTER_MS) return;

    const timer = window.setTimeout(() => {
      setDays(left);
      returnTo.current = document.activeElement;
      setOpen(true);
      requestAnimationFrame(() => setShown(true));
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center px-4 pb-4 pt-10 transition-opacity duration-200 sm:items-center sm:p-6 ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <button
        type="button"
        aria-label="Close this offer"
        onClick={() => close()}
        className="absolute inset-0 -z-10 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-popup-headline"
        tabIndex={-1}
        className={`relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-line-2 bg-ink-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] outline-none transition-transform duration-300 ${
          shown ? 'translate-y-0' : 'translate-y-3'
        }`}
      >
        {/* the accent is the offer's, so it runs along the top edge rather than behind the words */}
        <span aria-hidden className="block h-1 w-full bg-[linear-gradient(120deg,#ff5a1f_0%,#ff8a3d_100%)]" />

        <button
          type="button"
          onClick={() => close()}
          aria-label="Close this offer"
          className="absolute end-3 top-4 grid size-8 place-items-center rounded-full text-fg-3 transition-colors hover:bg-white/10 hover:text-fg"
        >
          <X size={16} />
        </button>

        <div className="px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember-soft px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-ember-2">
            <Clock3 size={13} />
            Leaving soon
          </span>

          <h2
            id="offer-popup-headline"
            className="mt-3 font-display text-[25px] font-semibold leading-[1.12] tracking-tighter sm:text-[28px]"
          >
            {OFFER.headline}
          </h2>

          <p className="mt-2.5 text-[14.5px] leading-relaxed text-fg-2">{OFFER.line}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">{OFFER.detail}</p>

          {days !== null && (
            <p className="mt-4 text-[13px] font-medium text-ember-2">
              {days === 1 ? 'Last day: the offer closes today.' : `${days} days left, then the offer closes.`}
            </p>
          )}

          <Link
            href={REGISTER_HREF}
            onClick={() => close(true)}
            className="btn btn-ember mt-5 w-full justify-center"
          >
            <span>{OFFER.cta}</span>
            <span className="arrow" aria-hidden>
              <ArrowUpRight size={16} strokeWidth={2.2} />
            </span>
          </Link>

          <p className="mt-3.5 text-center text-[12.5px] text-fg-3">
            Already with us?{' '}
            <Link href={LOGIN_HREF} onClick={() => close(true)} className="text-fg-2 underline underline-offset-4 hover:text-fg">
              Log in and deposit
            </Link>
          </p>

          <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-fg-3">
            Minimum deposit $100. Cashback is credited to your account and released as you trade. Trading involves
            risk and you can lose more than you deposit.
          </p>
        </div>
      </div>
    </div>
  );
}
