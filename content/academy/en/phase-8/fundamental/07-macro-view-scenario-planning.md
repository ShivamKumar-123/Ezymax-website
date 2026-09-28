---
slug: "p8-f-macro-view-scenario-planning"
title: "Building a macro view and scenario planning"
summary: "Combine regimes, policy cycles and themes into a written macro view with explicit scenarios, probabilities, signposts and trade expressions."
order: 7
version: 1
takeaways:
  - "A professional macro view is written down, specific and falsifiable, with probabilities rather than certainties."
  - "Scenario planning forces you to consider several outcomes, estimate their impact on each instrument and judge whether the risk-reward is attractive."
  - "Signposts are pre-defined data points or price levels that tell you which scenario is unfolding and when to change your view."
  - "The best trade expression is the instrument that responds most to your view while being least exposed to the risks you cannot judge."
practice:
  label: "Write a one-page macro view for USDJPY with three scenarios and signposts, then open the USDJPY daily chart on your demo account and mark the price levels that would confirm each scenario."
  symbol: "USDJPY"
quiz:
  - question: "Three scenarios for a long trade have probabilities 55%, 25% and 20% with expected moves of +2%, +4% and -5%. What is the probability-weighted expected move?"
    options:
      - "+0.33%"
      - "+1.1%"
      - "+2.0%"
      - "-1.0%"
    answer: 1
    explanation: "0.55 x 2 + 0.25 x 4 + 0.20 x (-5) = 1.1 + 1.0 - 1.0 = +1.1%."
  - question: "What is a signpost in scenario planning?"
    options:
      - "A pre-defined observation that indicates which scenario is becoming more likely"
      - "A technical indicator that always predicts direction"
      - "The final profit target of a trade"
      - "A news headline chosen after the event to explain the move"
    answer: 0
    explanation: "Signposts are chosen in advance so that you update your probabilities based on evidence rather than on the price move itself or hindsight."
  - question: "Your view is that US inflation will fall faster than expected, but you have no view on global risk appetite. Which expression best isolates your view?"
    options:
      - "A large long position in a high-beta crypto asset"
      - "A long AUDUSD position, which depends heavily on risk appetite"
      - "A position that benefits mainly from lower US yields, such as long gold or a short USD position against a low-beta currency"
      - "No position, because views can never be expressed"
    answer: 2
    explanation: "Good expressions respond directly to the variable in your view while minimising exposure to factors you have not analysed. AUD and crypto carry large risk-appetite exposure."
  - question: "Why should a macro view include an explicit invalidation condition?"
    options:
      - "Because the broker requires it"
      - "Because a view without invalidation guarantees profits"
      - "Because it removes the need for stop losses"
      - "Because it defines in advance when the thesis is wrong, preventing you from holding a losing view out of attachment"
    answer: 3
    explanation: "Invalidation protects against confirmation bias. Stops are still needed for individual trades; the invalidation condition governs the view itself."
---

The previous chapters described the pieces: growth and inflation regimes, monetary cycles, commodity shocks, structural themes and long currency cycles. This chapter turns them into a process. The goal is a macro view that is written, specific and testable, expressed as scenarios with probabilities, and connected to concrete instruments and risk limits.

## What a professional macro view contains

A useful macro view fits on one page and answers six questions:

1. **Regime:** where are growth and inflation momentum, and in which quadrant does each major economy sit?
2. **Policy:** where is each relevant central bank in its rate and balance sheet cycle, and what is priced?
3. **Themes and shocks:** which structural or geopolitical factors are active now?
4. **Consensus:** what does the market already expect? A view that agrees with consensus has little edge.
5. **Your difference:** where and why do you disagree with pricing?
6. **Invalidation:** what evidence would prove you wrong?

The fourth and fifth questions matter most. Macro knowledge only becomes a trading edge when your expectations differ from what is priced, and you can explain why.

## Scenario planning

Instead of a single forecast, professionals define three or four scenarios, assign rough probabilities, and estimate how each instrument would respond.

```svg
<svg viewBox="0 0 560 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#121216"/>
  <rect x="20" y="115" width="130" height="50" rx="6" fill="none" stroke="#ff5a1f" stroke-width="2"/>
  <text x="85" y="137" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13" text-anchor="middle">Macro view</text>
  <text x="85" y="154" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle">Long USDJPY</text>
  <line x1="150" y1="140" x2="250" y2="55" stroke="#3a3a44" stroke-width="2"/>
  <line x1="150" y1="140" x2="250" y2="140" stroke="#3a3a44" stroke-width="2"/>
  <line x1="150" y1="140" x2="250" y2="225" stroke="#3a3a44" stroke-width="2"/>
  <rect x="250" y="30" width="290" height="50" rx="6" fill="none" stroke="#22c55e" stroke-width="2"/>
  <text x="262" y="52" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Soft landing  p = 55%</text>
  <text x="262" y="70" fill="#22c55e" font-family="Inter, Arial, sans-serif" font-size="12">Expected move +2%</text>
  <rect x="250" y="115" width="290" height="50" rx="6" fill="none" stroke="#22c55e" stroke-width="2"/>
  <text x="262" y="137" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">Re-acceleration  p = 25%</text>
  <text x="262" y="155" fill="#22c55e" font-family="Inter, Arial, sans-serif" font-size="12">Expected move +4%</text>
  <rect x="250" y="200" width="290" height="50" rx="6" fill="none" stroke="#ef4444" stroke-width="2"/>
  <text x="262" y="222" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="13">US recession  p = 20%</text>
  <text x="262" y="240" fill="#ef4444" font-family="Inter, Arial, sans-serif" font-size="12">Expected move -5%</text>
  <text x="20" y="272" fill="#c9c9d1" font-family="Inter, Arial, sans-serif" font-size="12">Probability-weighted outcome: +1.1%, worst scenario -5%</text>
</svg>
```

```text
Scenario          Probability   Move in USDJPY   Weighted
Soft landing         0.55           +2%            +1.10%
Re-acceleration      0.25           +4%            +1.00%
US recession         0.20           -5%            -1.00%
Expected move                                      +1.10%
```

The expected value is positive, but the table reveals something a single forecast hides: the bad scenario is larger than either good one, and it has a one-in-five chance. That asymmetry argues for a moderate position size, a clear stop based on the daily chart, and perhaps a preference for an expression with less downside in a recession. Probabilities are subjective, so their value lies in forcing honesty about uncertainty, not in precision.

## Signposts and updating

For each scenario, choose two or three signposts: data or price behaviour that would make it more likely.

| Scenario | Signposts |
|---|---|
| Soft landing | Payrolls growing modestly, unemployment stable, core inflation drifting lower |
| Re-acceleration | PMIs above 55, wage growth rising, futures removing cuts |
| US recession | Jobless claims rising steadily, yield curve steepening from inversion, credit spreads widening |

Review signposts on a fixed schedule, for example after each major data release and in a monthly review. Adjust probabilities in steps rather than jumping from one extreme to the other. Use the economic calendar in the Client Area to schedule the releases that feed each signpost.

## Choosing the trade expression

A macro view can be expressed through many instruments. Choose the one that responds most directly to the variable you have analysed, with the least exposure to variables you have not.

> **Example:** Your view is that US inflation will fall faster than markets expect. Long AUDUSD would benefit from a weaker dollar but also depends heavily on Chinese growth and risk appetite. Long NAS100 benefits from lower yields but is exposed to earnings. Long XAUUSD, or short USDCHF, responds more directly to lower US real yields with less dependence on global growth. None is risk-free, but the cleaner expressions make the trade's result more a test of your actual view.

Also consider carrying costs. A position held for three months pays or earns swap every night, so a view with a small expected move can be eroded by financing costs.

## Common mistakes

- **Scenarios that are all variations of one outcome.** If every scenario is bullish to different degrees, you have not considered the real alternatives. At least one scenario should be clearly bad for your position.
- **Probabilities that never change.** If your numbers stay the same after a string of surprising data, you are defending the view rather than testing it.
- **Updating on price alone.** A falling price is information, but signposts should mostly be economic evidence; otherwise the view simply follows the chart.
- **Too many views at once.** Most traders can maintain two or three well-researched macro views. Beyond that, the analysis becomes shallow and the positions start to overlap.

## In practice

- Write the view before the week begins and date it, so you can review later what you believed and why.
- Keep the view separate from open positions. Positions follow the view, not the other way round.
- Limit the combined risk of all positions expressing one macro view, because they tend to lose together if the view is wrong.
- Review the accuracy of your scenario probabilities every quarter; persistent overconfidence is common and fixable.

> **Risk warning:** Scenario analysis structures uncertainty but does not remove it. Macro trades held over weeks or months face gaps, swaps and adverse moves, and leveraged CFD positions can lose more than you expect.
