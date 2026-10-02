// Demo build (NEXT_PUBLIC_KALKS_MODE=demo): the options onboarding without the gateway. The disclosure is v1 as
// seeded by services/gateway/migrations/20261002150000_options_suitability.sql; the quiz text comes from the
// `options` i18n namespace and is graded here with the same answers as services/gateway/src/suitability.rs.

import type { QuizOutcome, Suitability } from "./api";

/** Question id -> correct option index (mirrors OPTIONS_QUIZ in the gateway). */
export const DEMO_ANSWERS: Record<string, number> = {
  "call-right": 1,
  "put-payout": 2,
  "buyer-max-loss": 0,
  "seller-max-loss": 3,
  "seller-margin": 1,
  breakeven: 2,
  settlement: 3,
  "time-decay": 1,
  "knock-out": 0,
  delta: 2,
};

const PASS_MARK = 8;

const DISCLOSURE_V1 = `Options are complex instruments and carry a high level of risk. Read this disclosure in full before you trade Kalks FX Options, and only trade with money you can afford to lose.

## 1. What you are trading

Kalks FX Options are European-style options on 13 underlyings: forex major and cross pairs, gold, silver and crude oil (WTI and Brent). They are over-the-counter contracts between you and Kalks. They are not traded on an exchange and cannot be transferred to another broker. Options use the same trading account and the same funds as your CFD positions.

## 2. Kalks is your counterparty and sets the prices

- Kalks quotes every option and takes the other side of every trade. When you make money on an option, Kalks loses the same amount, and when you lose, Kalks gains. This is a conflict of interest.
- Option prices (premiums) are set by Kalks with its own pricing models and volatility inputs, plus a spread. They are not set by an exchange or by other market participants. The price you can sell at (bid) is always lower than the price you can buy at (ask).
- You can close an option before expiry only at the price Kalks quotes at that moment. In fast markets, close to the expiry cut, or when trading is halted, spreads can widen and new trades can be refused.

## 3. Buying options: you can lose 100% of the premium

- When you buy an option you pay the full premium upfront. If the option expires out of the money it is worthless, and you lose the whole premium plus commission.
- Options lose value as time passes (time decay). Short-dated options, including same-day (0DTE) expiries, can lose most of their value within hours.
- Being right about the direction is not enough. The price has to move far enough, and soon enough, to cover the premium you paid.

## 4. Selling options: you can lose much more than the premium

- When you sell (write) an option you receive the premium, but you must pay the buyer if the option ends in the money. Losses on a sold call grow without limit as the price rises. Losses on a sold put can be many times the premium you received. Losses on sold options can use up your entire account balance.
- Selling options requires margin. Margin is calculated from stress scenarios of price and volatility, can increase at any time (for example before weekends or in volatile markets), and must be covered by your own cash. Bonus and credit cannot be used for premiums or margin.
- If your equity falls below the required margin you will get a margin call, and your positions can be closed automatically at the prices quoted at that time (stop-out), possibly at a large loss and without further notice.
- Prices can gap, for example over a weekend or after news. A gap can cause a loss much larger than you expected before a stop-out takes effect.

## 5. Barrier options can knock out

- A knock-out option is cancelled as soon as the underlying price touches its barrier, even briefly and even if the price moves back afterwards. You lose the premium you paid and nothing is refunded.
- A knock-in option only becomes a normal option if the barrier is touched. If the barrier is never touched, it expires worthless.
- Barriers are watched continuously on the mid price of the underlying. If the market opens beyond a barrier after a weekend or holiday, the barrier counts as touched at the opening price.

## 6. Cash settlement at a 30-minute average price

- All options are settled in cash, in US dollars. You never receive or deliver currency, metal or oil.
- Options are exercised automatically at the expiry cut (by default 10:00 New York time). The settlement price is the time-weighted average of the mid price over the 30 minutes before the cut. It can differ from the price at the moment of the cut and from prices at other providers.
- An option that is in the money at settlement pays the difference between the settlement price and the strike, multiplied by the contract size. An option that is out of the money expires worthless.
- New positions cannot be opened in the last minutes before the cut, and closing can be restricted shortly before it.
- If a settlement price turns out to be wrong, Kalks may correct it within one hour of the cut. Settlement proceeds can be held for that hour before you can withdraw them.

## 7. Other risks

- Volatility: small moves in the underlying can cause large percentage changes in an option's price.
- Liquidity: you can only trade while Kalks is quoting. Trading can be halted, set to close-only, or limited per client.
- Technology: outages, delays or errors in prices, platforms or connections can affect your ability to open or close positions.
- Erroneous trades: trades executed at a clearly wrong price can be cancelled or corrected.
- Tax: you are responsible for any taxes on your results.

## 8. Your confirmation

By accepting this disclosure you confirm that you have read and understood it; that you understand how options work; that you can lose all the money you pay for options and, when you sell options, much more than the premium you receive; and that trading options is appropriate for you given your knowledge, experience and financial situation. Past performance is not a guide to future results. Nothing Kalks provides is investment advice.`;

/** A demo client with verified identity who still has the disclosure and the quiz to do. Question text comes from
 *  the i18n catalog (empty here). */
export function demoSuitability(): Suitability {
  return {
    product: "options",
    kycVerified: true,
    kycStatus: "verified",
    disclosure: { version: 1, title: "Kalks FX Options: risk disclosure", bodyMd: DISCLOSURE_V1, publishedAt: "2026-10-02T09:00:00Z" },
    disclosureAccepted: false,
    acceptedVersion: null,
    acceptedAt: null,
    quizPassed: false,
    quizPassedAt: null,
    quizScore: null,
    quizAttempts: 0,
    eligible: false,
    missing: ["disclosure", "quiz"],
    quiz: { total: 10, passMark: PASS_MARK, questions: Object.keys(DEMO_ANSWERS).map((id) => ({ id, text: "", options: ["", "", "", ""] })) },
  };
}

/** Grades like the gateway does (explanations come from the i18n catalog). */
export function demoGrade(answers: Record<string, number>): Pick<QuizOutcome, "passed" | "score" | "total" | "passMark" | "wrong"> {
  const ids = Object.keys(DEMO_ANSWERS);
  const wrong = ids.filter((id) => answers[id] !== DEMO_ANSWERS[id]).map((id) => ({ id, explanation: "" }));
  const score = ids.length - wrong.length;
  return { passed: score >= PASS_MARK, score, total: ids.length, passMark: PASS_MARK, wrong };
}
