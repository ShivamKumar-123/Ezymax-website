/**
 * The promotion the website shows a visitor who has not signed up yet.
 *
 * It mirrors the live offer in the growth service (`banners` row, Back Office -> Promotions): the same wording,
 * the same minimum, and above all the same `endsAt`, so the website never advertises something the Client Area
 * has already stopped running. The popup renders nothing once that instant has passed, which is what keeps a
 * finished campaign from sitting on the home page until somebody remembers to take it down.
 *
 * `id` is part of the key that remembers a visitor has seen this, so changing the offer must change the id -
 * otherwise someone who dismissed the last campaign never sees the new one.
 */
export const OFFER = {
  id: 'cashback-20-first-deposit',
  /** Back Office -> Promotions -> "20% cashback on your first deposit" (growth banners.id 2) */
  headline: '20% cashback on your first deposit',
  /** What the visitor has to do, in the order they have to do it. */
  line: 'Open an account, deposit $100 or more, and 20% of it comes back to you as cashback.',
  /** The detail that stops the offer sounding too good to be true. */
  detail: 'Credited automatically and released to your balance as you trade. No code to enter.',
  cta: 'Create your account',
  /** growth banners.ends_at. UTC, and the same instant the Client Area stops showing the offer. */
  endsAt: '2026-12-04T23:59:00Z',
} as const;
