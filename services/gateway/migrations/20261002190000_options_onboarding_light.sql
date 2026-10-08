-- Options onboarding made light (founder decision 2026-10-02). A client is eligible for Ezymex FX Options, demo and
-- live, once they have accepted the options disclosure: any published version (suitability.rs). Verified identity
-- and the knowledge quiz are no longer needed for options (withdrawals still need verified identity, kyc.rs); the
-- quiz stays available as an optional self-test. No schema change: acceptances of v1 stay valid.
--
-- Disclosure v2 for every broker (append-only: a new row, v1 stays on record): one short, plain-language paragraph
-- of key points, then the full terms (the substance of v1, updated for the Ezymex order book). Brokers created later
-- get a copy of the platform's current version on first use, as before.

INSERT INTO disclosures (tenant_id, product, version, title, body_md, published_at)
SELECT t.id, 'options', 2, 'Ezymex FX Options: key points and terms', btrim($md$
Options let you trade on where a price is heading. Here are the key points. When you buy an option, the most you can lose is what you pay for it. When you sell an option, you can lose more than you receive, and selling uses margin from your account. Prices are set on the Ezymex order book and by Ezymex. Options settle in cash at expiry, so you never deliver or receive anything. As with any trading, only use money you can afford to lose.

## Full terms

### 1. What you are trading

Ezymex FX Options are European-style options on 13 underlyings: forex major and cross pairs, gold, silver and crude oil (WTI and Brent). They are contracts on the Ezymex platform. They are not traded on a regulated exchange and cannot be transferred to another broker. Options use the same trading account and the same funds as your CFD positions.

### 2. How prices are set, and who is on the other side

- Option prices come from the Ezymex order book or are quoted by Ezymex directly. On the order book, your order is matched with orders of other Ezymex clients or of the Ezymex market maker, which quotes every listed series from its own pricing models. Some options, such as barrier options, are only quoted by Ezymex directly.
- When Ezymex quotes the price, or the Ezymex market maker takes the other side of your trade, Ezymex is your counterparty: when you make money on that trade, Ezymex loses the same amount, and when you lose, Ezymex gains. This is a conflict of interest.
- The price you can sell at (bid) is lower than the price you can buy at (ask). You can close an option before expiry only at the prices available at that moment. In fast markets, close to the expiry cut, or when trading is halted, prices can be wide or missing and orders can be refused.
- Commission or fees may apply. They are shown before you trade.

### 3. Buying options

- When you buy an option you pay the full premium upfront. If the option expires out of the money it is worthless, and you lose the whole premium plus fees.
- Options lose value as time passes (time decay). Short-dated options, including same-day (0DTE) expiries, can lose most of their value within hours.
- Being right about the direction is not enough. The price has to move far enough, and soon enough, to cover the premium you paid.

### 4. Selling options

- When you sell (write) an option you receive the premium, but you must pay the buyer if the option ends in the money. Losses on a sold call grow without limit as the price rises. Losses on a sold put can be many times the premium you received. Losses on sold options can use up your entire account balance.
- Selling options requires margin. Margin is calculated from stress scenarios of price and volatility, can increase at any time (for example before weekends or in volatile markets), and must be covered by your own cash. Bonus and credit cannot be used for premiums or margin.
- If your equity falls below the required margin you will get a margin call, and your positions can be closed automatically (stop-out) at the prices available at that time, possibly at a large loss and without further notice. A position that cannot be closed on the order book can be taken over by the Ezymex market maker at a price that includes a liquidation fee.
- Prices can gap, for example over a weekend or after news. A gap can cause a loss much larger than you expected before a stop-out takes effect.

### 5. Barrier options

- A knock-out option is cancelled as soon as the underlying price touches its barrier, even briefly and even if the price moves back afterwards. You lose the premium you paid and nothing is refunded.
- A knock-in option only becomes a normal option if the barrier is touched. If the barrier is never touched, it expires worthless.
- Barriers are watched continuously on the mid price of the underlying. If the market opens beyond a barrier after a weekend or holiday, the barrier counts as touched at the opening price.

### 6. Cash settlement at expiry

- All options are settled in cash, in US dollars. You never receive or deliver currency, metal or oil.
- Options are exercised automatically at the expiry cut (by default 10:00 New York time). The settlement price is the time-weighted average of the mid price over the 30 minutes before the cut. It can differ from the price at the moment of the cut and from prices at other providers.
- An option that is in the money at settlement pays the difference between the settlement price and the strike, multiplied by the contract size. An option that is out of the money expires worthless.
- New positions cannot be opened in the last minutes before the cut, and closing can be restricted shortly before it. The Ezymex market maker may keep quoting until one minute before the cut.
- If a settlement price turns out to be wrong, Ezymex may correct it within one hour of the cut. Settlement proceeds can be held for that hour before you can withdraw them.

### 7. Other risks

- Volatility: small moves in the underlying can cause large percentage changes in an option's price.
- Liquidity: you can only trade while prices are available. Trading can be halted, set to close-only, or limited per client.
- Technology: outages, delays or errors in prices, platforms or connections can affect your ability to open or close positions.
- Erroneous trades: trades executed at a clearly wrong price can be cancelled or corrected.
- Tax: you are responsible for any taxes on your results.

### 8. Your confirmation

By accepting these terms you confirm that you have read the key points above and understand how options work; that you can lose all the money you pay for options and, when you sell options, more than the premium you receive; and that trading options is appropriate for you given your knowledge, experience and financial situation. Past performance is not a guide to future results. Nothing Ezymex provides is investment advice.
$md$, E' \n'), now()
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM disclosures d WHERE d.tenant_id = t.id AND d.product = 'options' AND d.version >= 2)
ON CONFLICT (tenant_id, product, version) DO NOTHING;
