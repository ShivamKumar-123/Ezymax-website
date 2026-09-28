---
slug: "p7-f-single-stocks-and-earnings"
title: "Single stocks and earnings"
summary: "How company earnings, guidance and corporate actions move stock CFDs such as AAPL, TSLA and NVDA, and how to manage earnings-gap risk."
order: 6
version: 1
takeaways:
  - "Stock prices react to results relative to expectations, and guidance about future quarters often matters more than the reported quarter."
  - "Most US companies report outside market hours, so the reaction appears as a gap at the next 09:30 New York open."
  - "A stop loss does not protect against a gap; the position is closed at the first available price, which can be far beyond the stop."
  - "Dividends and stock splits trigger adjustments on stock CFD positions so the mechanical price change does not create false profit or loss."
  - "Single stocks carry company-specific risk on top of market risk, so they usually need smaller sizes than indices."
practice:
  label: "On your demo account, open a daily chart of NVDA and find the last four earnings dates; measure the size of each opening gap in percent."
  symbol: "NVDA"
quiz:
  - question: "A company beats consensus earnings per share but lowers its revenue guidance for next quarter. What is a plausible reaction?"
    options:
      - "The stock must rise because EPS beat"
      - "The stock falls because the market prices the weaker outlook"
      - "The stock cannot move until the next report"
      - "Only the options market reacts"
    answer: 1
    explanation: "Prices discount the future, so a guidance cut can outweigh a beat on past results. A beat does not guarantee a rise."
  - question: "A trader is long 40 shares of a stock CFD from 120.00 with a stop at 115.00. After earnings, the stock opens at 107.00. What is the approximate loss?"
    options:
      - "200 USD"
      - "280 USD"
      - "520 USD"
      - "4,280 USD"
    answer: 2
    explanation: "The stop is filled at the first available price, around 107.00. The loss is (120.00 - 107.00) x 40 = 520 USD, not the 200 USD the stop distance suggested."
  - question: "What happens to a stock CFD position after a 4-for-1 stock split?"
    options:
      - "The position is adjusted so that quantity is multiplied by 4 and the price divided by 4, leaving value unchanged"
      - "The trader gains four times the position value"
      - "The position is closed automatically at a loss"
      - "Nothing, splits do not affect CFDs"
    answer: 0
    explanation: "A split changes the number of shares and the price proportionally. CFD positions are adjusted so their value is the same before and after."
  - question: "What is the implied move derived from options before earnings?"
    options:
      - "A guaranteed price target"
      - "The size of the last earnings gap"
      - "The analyst consensus for EPS"
      - "The size of move, in either direction, that option prices suggest the market expects"
    answer: 3
    explanation: "Option premiums around the report date imply an expected move size, not a direction or a guarantee."
---

Trading single-stock CFDs such as AAPL, TSLA, NVDA, META and NFLX gives you exposure to individual companies rather than a whole market. That concentration is the attraction and the danger. A company can gap 10% overnight on news that an index would barely notice. The biggest scheduled source of such moves is the quarterly earnings report.

## What an earnings report contains

US listed companies report results every quarter. The market focuses on a few numbers:

- **Earnings per share (EPS)**, usually the adjusted figure, compared with the analyst consensus.
- **Revenue**, compared with consensus. A company can beat on EPS through cost cutting while revenue disappoints, and the market often notices.
- **Guidance**, the company's own forecast for the next quarter or year. Because share prices discount the future, guidance frequently matters more than the quarter just reported.
- **Segment details and the management call**, where comments on margins, demand or spending plans can reverse the initial reaction.

As with economic data, what moves the price is the **surprise relative to expectations**. A company can post record profits and fall because investors expected even more. Before a report, the options market prices an **implied move**: the size of move, in either direction, that option premiums suggest. If a stock's implied move is 8%, a 4% reaction is modest, whatever the headlines say.

## Earnings gaps and why stops do not protect you

Most US companies report either before the 09:30 New York open or after the 16:00 close. The reaction therefore happens while the regular session is shut, and the stock CFD opens at a new level. There are no trades in between, so a stop loss cannot be filled at its level.

```svg
<svg viewBox="0 0 520 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <g font-family="Inter, Arial, sans-serif" font-size="12" fill="#c9c9d1">
    <line x1="60" y1="20" x2="60" y2="240" stroke="#3a3a44"/>
    <line x1="60" y1="240" x2="500" y2="240" stroke="#3a3a44"/>
    <text x="275" y="266" text-anchor="middle">Daily candles; earnings released after the close of the fourth candle</text>
    <text x="52" y="54" text-anchor="end">120</text>
    <text x="52" y="104" text-anchor="end">115</text>
    <text x="52" y="184" text-anchor="end">107</text>
    <line x1="60" y1="50" x2="500" y2="50" stroke="#3a3a44" stroke-dasharray="3 4"/>
    <line x1="60" y1="100" x2="500" y2="100" stroke="#ff5a1f" stroke-dasharray="6 4"/>
    <text x="495" y="94" text-anchor="end" fill="#ff5a1f">Stop 115.00</text>
    <line x1="60" y1="180" x2="500" y2="180" stroke="#3a3a44" stroke-dasharray="3 4"/>
    <line x1="100" y1="50" x2="100" y2="90" stroke="#22c55e"/>
    <rect x="92" y="62" width="16" height="20" fill="#22c55e"/>
    <line x1="150" y1="45" x2="150" y2="80" stroke="#22c55e"/>
    <rect x="142" y="55" width="16" height="15" fill="#22c55e"/>
    <line x1="200" y1="40" x2="200" y2="75" stroke="#ef4444"/>
    <rect x="192" y="48" width="16" height="18" fill="#ef4444"/>
    <line x1="250" y1="42" x2="250" y2="70" stroke="#22c55e"/>
    <rect x="242" y="50" width="16" height="10" fill="#22c55e"/>
    <line x1="320" y1="170" x2="320" y2="215" stroke="#ef4444"/>
    <rect x="312" y="180" width="16" height="25" fill="#ef4444"/>
    <line x1="370" y1="185" x2="370" y2="225" stroke="#22c55e"/>
    <rect x="362" y="192" width="16" height="20" fill="#22c55e"/>
    <line x1="285" y1="54" x2="285" y2="176" stroke="#c9c9d1" stroke-width="1.5"/>
    <text x="292" y="130">Gap: no trades</text>
    <text x="292" y="145">between 120 and 107</text>
    <text x="336" y="176">Stop filled near 107</text>
  </g>
</svg>
```

> **Example:** A trader is long 40 shares of a stock CFD at 120.00 with a stop at 115.00, planning to risk 5.00 x 40 = 200 USD. The company reports after the close and lowers guidance. The stock opens at 107.00. The stop becomes a market order and fills around 107.00, for a loss of 13.00 x 40 = 520 USD, more than two and a half times the plan.

This is why many traders either close or reduce single-stock positions before earnings, or deliberately size positions so that a gap of two or three times the implied move would still be survivable.

> **Risk warning:** Stock CFDs are leveraged. Earnings, regulatory news and guidance changes can gap prices far beyond your stop, and losses can exceed the amount you planned to risk.

## Corporate actions: dividends and splits

**Dividends.** When a stock goes ex-dividend, its price drops by roughly the dividend amount. On a CFD, long positions usually receive a dividend adjustment and short positions pay one, so the mechanical drop does not create a false gain for shorts or a loss for longs. These adjustments appear in your Portfolio history in the Client Area.

**Splits.** In a 4-for-1 split, each share becomes four and the price is divided by four. A CFD position of 10 shares at 800.00 becomes 40 shares at 200.00, with the same total value of 8,000 USD. The chart may be back-adjusted so the history stays comparable.

## Sessions and the broader market

US stock CFDs on Kalks trade during the regular session, 09:30 to 16:00 New York time, which is 16:30 to 23:00 server time during US daylight saving time. The first 30 minutes are usually the most volatile, as overnight news and orders are absorbed.

Single stocks also carry market risk. A stock's **beta** measures how much it tends to move relative to the index. High-beta names such as TSLA or NVDA often move more than SPX500 in both directions, so a broad sell-off can hit them hard even without company news. Large constituents also move the indices themselves: a big earnings reaction in a mega-cap can shift NAS100 on the same morning.

## In practice

- Check the earnings date for every stock you hold or plan to trade; follow the company's announcements and the News section of the Client Area in the days before.
- Compare your stop distance with the implied move. If the implied move is larger than your stop, you are effectively gambling on the report.
- Size single stocks smaller than indices for the same risk budget, because gaps are more frequent and larger.
- Read beyond the headline beat or miss: guidance and the tone of the call often decide the second-day move.
