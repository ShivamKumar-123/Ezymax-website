---
slug: "p4-f-earnings-season"
title: "Earnings season and stock CFDs"
summary: "How quarterly company results move single stocks and indices, and how to manage the overnight gap risk they create."
order: 6
version: 1
takeaways:
  - "US companies usually report before the 09:30 open or after the 16:00 close, so the reaction appears as a gap at the next session."
  - "Markets judge earnings per share, revenue and above all guidance against analyst estimates, not against last year."
  - "Large technology companies carry heavy index weights, so their results can move NAS100 and SPX500 as well as their own share price."
  - "A stop loss cannot protect you from an earnings gap; position size is the main risk control."
practice:
  label: "Find the next reporting date for one stock you follow in the News or calendar section, then look back on a daily AAPL, NVDA or TSLA chart for the gap after its last report."
  symbol: "NVDA"
quiz:
  - question: "A company beats EPS and revenue estimates but cuts next-quarter guidance. What is a realistic reaction?"
    options:
      - "The shares must rise because both headline numbers beat"
      - "There is no reaction to guidance"
      - "The shares can fall because guidance shapes future expectations"
      - "Only the index moves, not the share"
    answer: 2
    explanation: "Investors value companies on expected future profits. A guidance cut lowers those expectations and often outweighs a beat on the past quarter."
  - question: "You are short 40 shares of a stock CFD at 180.00 with a stop at 184.00. After earnings it opens at 195.00. What is the approximate loss?"
    options:
      - "160 USD"
      - "400 USD"
      - "600 USD"
      - "750 USD"
    answer: 2
    explanation: "The stop is inside the gap, so it fills near the open at 195.00. Loss = (195.00 - 180.00) x 40 = 600 USD, compared with the planned 160 USD."
  - question: "When do most large US companies publish quarterly results?"
    options:
      - "In the middle of the trading session"
      - "Before the 09:30 open or after the 16:00 close, New York time"
      - "Only on Saturdays"
      - "At the same moment as NFP"
    answer: 1
    explanation: "Reporting outside regular hours gives investors time to digest the numbers, which is why the reaction usually shows up as a gap at the next open."
  - question: "Why can NVDA's earnings move NAS100?"
    options:
      - "NAS100 is priced in NVDA shares"
      - "There is no link between single stocks and indices"
      - "Index CFDs are closed during earnings"
      - "NVDA is one of the largest weights in the index, so its price change directly changes the index value"
    answer: 3
    explanation: "NAS100 is weighted by market capitalisation, and the largest technology companies make up a large share of it. A big move in one of them shifts the whole index."
---

Four times a year, listed companies publish their quarterly results. For traders of US stock CFDs such as AAPL, TSLA, NVDA, META and NFLX, these reports are the single largest scheduled risk. For index traders they matter too, because a handful of large companies drive a big share of NAS100 and SPX500. This chapter explains what is reported, how the market judges it, and how to handle the gaps.

## The earnings calendar

Most large US companies report in a window that starts about two weeks after each quarter ends, so the busiest periods are mid-January to mid-February, mid-April to mid-May, mid-July to mid-August and mid-October to mid-November. Banks usually report first, followed by the large technology companies.

US stocks trade from 09:30 to 16:00 New York time, which is 16:30 to 23:00 on the Ezymex server clock. Companies almost always report outside those hours, either before the open or after the close. The reaction therefore appears at the next open as a gap, not as a gradual move you can trade out of.

## What the market judges

A report contains dozens of figures, but a few drive the reaction:

| Item | What it is | How the market reads it |
|---|---|---|
| Earnings per share (EPS) | Profit divided by shares outstanding | Compared with the analyst consensus |
| Revenue | Total sales | Shows whether growth is real or cost-driven |
| Guidance | Management's forecast for coming quarters | Often the biggest driver |
| Margins | Profit as a share of revenue | Signals pricing power and cost control |
| Key segment data | For example data-centre revenue or subscribers | Whatever story the stock is priced on |

The principle from earlier chapters applies: the market reacts to the difference between results and expectations. A company that doubles its profit can still fall if investors had been hoping for more, and a company that loses money can rally if the loss is smaller than feared and guidance improves.

## Gap risk in numbers

> **Example:** NVDA closes at 120.00 before reporting after the close. Results beat estimates and guidance is raised. The next session opens at 128.40, a gap of 7%. A trader long 20 share CFDs gains (128.40 - 120.00) x 20 = 168 USD at the open. A trader short 50 share CFDs from 120.00 with a stop at 123.00, a planned risk of 150 USD, has the stop filled near 128.40 for a loss of 8.40 x 50 = 420 USD.

```text
Planned risk on the short:   (123.00 - 120.00) x 50 = 150 USD
Actual loss after the gap:   (128.40 - 120.00) x 50 = 420 USD
Loss multiple versus plan:   420 / 150 = 2.8 x
```

The stop worked as designed, but a stop cannot fill in a gap. If you choose to hold a stock CFD through earnings, the practical control is position size: size the position so that a gap two or three times the normal daily range is still an acceptable loss.

## Earnings and the indices

Index CFDs trade almost around the clock during the week, so they react to after-hours reports immediately. When a heavyweight reports after the US close, NAS100 can move 1% or more in the evening while the underlying share is only trading in thin after-hours sessions. Results from the biggest companies also shift sentiment for the whole sector: a strong report from one chip maker can lift the others the next day.

## Other effects to know

- **Implied volatility**: option prices rise before earnings and fall sharply afterwards. The expected move priced in by options gives a rough idea of how large a gap the market considers normal.
- **Dividends**: stock and index CFDs are adjusted on ex-dividend dates. Long positions typically receive a cash adjustment and short positions pay it.
- **Corporate actions**: splits change the price and quantity but not the value of a position.

## In practice

- Check reporting dates for any stock you hold at least a week ahead.
- Decide in advance whether to close, reduce or hold through the report, and size for a gap, not for your stop.
- If you want to trade the reaction, wait for the first 15 to 30 minutes of the regular session to see whether the gap holds or fills.
- Remember that index positions carry some earnings risk during the season too.

> **Risk warning:** Stock CFDs are leveraged and can gap far beyond your stop loss at the open after earnings. You can lose significantly more than your planned risk on a single report.
