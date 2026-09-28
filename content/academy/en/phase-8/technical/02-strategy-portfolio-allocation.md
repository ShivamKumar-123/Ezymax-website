---
slug: "p8-t-strategy-portfolio-allocation"
title: "A portfolio of strategies and capital allocation"
summary: "Combine several uncorrelated strategies, allocate risk between them by volatility, and set rules for monitoring, rebalancing and switching strategies off."
order: 2
version: 1
takeaways:
  - "Combining strategies with low return correlation reduces portfolio volatility and drawdown more than any single improvement to one strategy."
  - "Risk-based allocation, such as scaling each strategy to the same volatility contribution, prevents one volatile strategy from dominating results."
  - "Correlation between strategies must be measured on their returns, not assumed from the symbols they trade."
  - "Each strategy needs pre-defined rules for reducing risk or switching off, based on drawdown limits set from its tested history."
practice:
  label: "On your demo account, export the trade history of two strategies from the Portfolio section of the Client Area and compare their monthly returns side by side."
  symbol: "XAUUSD"
quiz:
  - question: "Two strategies each have 10% annual volatility and a return correlation of 0.2. With equal weights, what is the approximate portfolio volatility?"
    options:
      - "10%"
      - "5%"
      - "About 7.7%"
      - "12%"
    answer: 2
    explanation: "Variance = 0.25 x 100 + 0.25 x 100 + 2 x 0.25 x 0.2 x 100 = 60. The square root of 60 is about 7.75%. With a correlation of 1 it would stay at 10%."
  - question: "Strategy A has twice the return volatility of strategy B at the same risk per trade. Under equal volatility allocation, how should risk per trade compare?"
    options:
      - "A should use half the risk per trade of B"
      - "A should use twice the risk per trade of B"
      - "Both should use the same risk per trade"
      - "A should be switched off"
    answer: 0
    explanation: "To equalise volatility contributions, risk scales inversely with volatility. A is twice as volatile, so it receives half the risk per trade."
  - question: "Why can two strategies on different symbols still be highly correlated?"
    options:
      - "Because different symbols can never be correlated"
      - "Because a broker links all strategies"
      - "Because correlation is only measured on prices"
      - "Because they may express the same underlying factor, such as USD weakness or risk appetite"
    answer: 3
    explanation: "A long EURUSD trend system and a long XAUUSD trend system can both profit and lose on the same dollar moves. Measure correlation on the strategies' returns."
  - question: "What is a sensible basis for a strategy's switch-off rule?"
    options:
      - "Any losing week"
      - "A drawdown clearly larger than the worst drawdown expected from its tested history, for example 1.5 times"
      - "The trader's mood that day"
      - "A single losing trade larger than average"
    answer: 1
    explanation: "Drawdowns are normal. A rule based on a multiple of the tested maximum drawdown distinguishes ordinary losing periods from a strategy that may have stopped working."
---

A single strategy, however good, has losing periods that can last months. Professional traders and funds rarely rely on one approach. They run a **portfolio of strategies** that make money in different conditions, and they allocate risk between them deliberately. This is the trading equivalent of diversification, and it is one of the few genuine free lunches available.

## Why combining strategies works

The benefit depends on correlation between strategy returns. When one strategy is in drawdown, another may be flat or profitable, so the combined equity curve is smoother.

```text
Two strategies, each 10% annual volatility, equal weight 50/50

Portfolio variance = w1^2 x s1^2 + w2^2 x s2^2 + 2 x w1 x w2 x corr x s1 x s2

Correlation 1.0:  0.25x100 + 0.25x100 + 2x0.25x1.0x100 = 100  -> vol 10.0%
Correlation 0.2:  0.25x100 + 0.25x100 + 2x0.25x0.2x100 =  60  -> vol  7.75%
Correlation 0.0:  0.25x100 + 0.25x100 + 0              =  50  -> vol  7.07%
```

With low correlation the combination is about a quarter less volatile while the expected return is the same average. Lower volatility means shallower drawdowns, which means you can run the portfolio at a higher overall risk for the same pain, or keep the same risk and sleep better.

## Building the mix

Look for strategies that differ in at least one of these dimensions:

- **Logic:** trend following, mean reversion, breakout, carry.
- **Timeframe:** a D1 trend system and an H1 intraday system respond to different price behaviour.
- **Asset class:** FX, metals, indices and energies are driven by different factors, though not always.
- **Holding period:** strategies that hold for hours are less exposed to overnight gaps than those holding for weeks.

A classic pairing is trend following with mean reversion. Trend systems profit in extended moves and bleed in ranges; mean-reversion systems do the opposite. Combined, the portfolio has fewer dry spells.

Correlation must be measured on **returns**, not assumed. A long-only EURUSD trend system and a long-only XAUUSD trend system look diversified but both depend heavily on the US dollar. Compute the correlation of their weekly or monthly returns from backtests or, better, from demo and live records.

## Allocating risk

Equal capital does not mean equal risk. A volatile gold breakout system can dominate a portfolio even at the same risk per trade as a quiet EURUSD mean-reversion system. The usual answer is to allocate by **volatility contribution**.

> **Example:** A 50,000 USD account runs three strategies. Tested at 1% risk per trade, their monthly return volatility is: A (XAUUSD trend) 6%, B (EURUSD and GBPUSD mean reversion) 3%, C (NAS100 breakout) 4%. To give each roughly a 2% monthly volatility contribution, scale risk per trade by 2 / volatility. A: 1% x 2/6 = 0.33% (about 167 USD). B: 1% x 2/3 = 0.67% (about 333 USD). C: 1% x 2/4 = 0.50% (250 USD). Total risk per trade across one signal from each is 1.50%, and no single strategy dominates the equity curve.

This method ignores correlation, so check the combined result. If two strategies are highly correlated, treat them as one for allocation purposes and split a single budget between them. Rebalance allocations on a fixed schedule, such as quarterly, rather than after every good or bad week, to avoid chasing recent performance.

## Monitoring and switch-off rules

Every strategy in the portfolio needs written rules for when to cut risk and when to stop:

1. **Reduce:** if the strategy's drawdown exceeds its tested maximum drawdown, halve its risk.
2. **Suspend:** if drawdown reaches about 1.5 times the tested maximum, stop live trading and move it back to demo.
3. **Review:** investigate whether market conditions or costs have changed, or whether the original backtest was overfitted.
4. **Reinstate:** only after the strategy meets pre-defined recovery criteria on demo.

Running each strategy on a separate trading account, created from the Accounts section of the Client Area, keeps statements clean and makes it easy to measure each one individually in the Portfolio section.

## Common mistakes

- **Collecting strategies that are variations of one idea.** Five trend systems on USD pairs are one bet.
- **Dropping the strategy that is currently losing.** Diversification only works if you keep the currently unpopular component.
- **Ignoring total exposure.** Three strategies can all be long USD at the same time; cap net exposure per currency and asset class.
- **Adding strategies without enough history.** A new strategy needs a meaningful sample before it earns a full allocation.

> **Risk warning:** Diversifying across strategies reduces but does not eliminate risk. In market stress correlations can rise sharply and all strategies can lose together. CFDs are leveraged and losses can exceed what you expect.
