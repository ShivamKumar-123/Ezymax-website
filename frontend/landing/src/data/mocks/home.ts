/**
 * Home-page copy. Site-wide chrome copy (nav, footer, modal) lives in
 * `src/data/mocks/site.ts`. Components never import this directly — the view
 * passes it down as props (component-conventions.md → "Data rules").
 *
 * The one sentence everything on this page proves: on FX Artha, your broker
 * never holds your money. Only the margin for your open trades is locked — the
 * rest is yours to withdraw, right now, without asking anyone.
 */

export const heroContent = {
  /** Typewriter cycle — the first entry is the canonical h1 (SEO/SR text). */
  headlineVariants: [
    "Trade CFDs without handing your money to a broker.",
    "Your money never leaves your control.",
    "The broker that can't touch your balance.",
    "Only your margin is locked. Everything else is yours.",
  ],
  /** Base layer (LCP) is the lighter jpg; the heavier png is brushed in. */
  beforeSrc: "/assets/hero/hero-standing.jpg",
  afterSrc: "/assets/hero/hero-portrait.png",
} as const;

export const problemSolution = {
  eyebrow: "Where your money actually sits",
  heading: "Your broker's balance sheet, or a contract you control.",
  intro:
    "With a normal broker, your deposit lands in their bank account. They decide when you get it back. Withdrawals go through review, batching, business hours — and if the firm has problems, so do you. FX Artha removes that step entirely: the contract locks margin when you open a position, settles P&L when you close it, and releases your free balance whenever you ask. Nobody approves anything.",
  cards: [
    {
      title: "A traditional broker",
      steps: [
        "You deposit",
        "Money enters the broker's bank account",
        "The broker controls your full balance",
        "You request a withdrawal",
        "Review → finance batch → next business day",
        "The broker approves",
        "You get paid",
      ],
      closing: "Every step depends on trusting the broker.",
      image: "/assets/sections/problem.jpg",
    },
    {
      title: "FX Artha",
      steps: [
        "You allocate from your wallet",
        "Funds enter the trading contract",
        "Only margin for open trades is locked",
        "Trade executes",
        "Profit credited, loss deducted — automatically",
        "Idle balance stays yours the whole time",
        "Withdraw whenever you want",
      ],
      closing: "No custody. No permission step.",
      image: "/assets/sections/solution.jpg",
    },
  ],
  quote: "Control stays with you. Execution stays with the system.",
} as const;

export const marginCalculator = {
  eyebrow: "The part no broker offers",
  heading: "$10,000 in. $540 locked. $9,460 still yours.",
  intro:
    "Open 0.5 lots of EUR/USD at 1:100 and the contract locks $540 of margin. On every other platform, the other $9,460 is stuck too — sitting in the broker's account until they release it. Here it isn't. Free balance is free: withdraw it mid-trade, at 2am, on a Sunday, while your position is still open.",
  depositLabel: "Allocated",
  lotsLabel: "Position size",
  leverageLabel: "Leverage",
  leverageOptions: [1, 10, 50, 100, 200],
  lockedLabel: "Locked margin",
  freeLabel: "Withdrawable now",
  note: "No withdrawal request. No approval queue. No waiting.",
  assumptions:
    "Example uses EUR/USD at 1.0800; 1 lot = 100,000 units. CFDs are leveraged products. You can lose more than you allocate.",
} as const;

export const tickerBand = {
  label: "The FX Artha promise",
  /** Full sentence for screen readers & crawlers; the strip is decorative. */
  sentence:
    "In every trade, your money stays yours — only margin locks, profits settle automatically, and everything else is free to withdraw, together in your control.",
  /**
   * The sentence split into flow segments. `em` words carry the lime-gradient
   * emphasis; `curve`/`check`/`tag`/`chip` are the inline visual punctuation.
   */
  segments: [
    { type: "text", value: "In every" },
    { type: "em", value: "trade," },
    { type: "text", value: "your money stays" },
    { type: "em", value: "yours" },
    { type: "curve" },
    { type: "text", value: "— only margin locks," },
    { type: "tag", value: "Live settlement" },
    { type: "text", value: "profits settle" },
    { type: "em", value: "automatically," },
    { type: "check" },
    { type: "text", value: "and everything else is" },
    { type: "em", value: "free" },
    { type: "text", value: "to withdraw," },
    { type: "chip", value: "$9,460 withdrawable" },
    { type: "text", value: "together in your" },
    { type: "em", value: "control." },
  ],
  hint: "Scroll",
} as const;

export const howItWorks = {
  eyebrow: "Wallet to first trade · 5 steps",
  heading: "Live in under ten minutes.",
  intro:
    "From the moment you connect a wallet to the moment a profit lands back in it — here is what actually happens.",
  steps: [
    {
      title: "Connect your wallet",
      body: "Connect and verify. The wallet stays yours throughout.",
    },
    {
      title: "Open a trading account",
      body: "FX Artha web platform, or connect MT5 if that's your setup.",
    },
    {
      title: "Allocate funds",
      body: "Into the trading contract — not into a broker's account.",
    },
    {
      title: "Trade",
      body: "Forex, indices, commodities, crypto. Funded or leveraged.",
    },
    {
      title: "Withdraw",
      body: "Free balance settles back to your wallet. Any time, including mid-trade.",
    },
  ],
  band: "/assets/sections/market-band.jpg",
  bandAlt: "A bull and a bear facing each other in gold light",
  quote: "Structured flow. No manual control. Fully system-driven.",
} as const;

export const automaticPnl = {
  id: "settlement",
  eyebrow: "Automatic settlement",
  heading: "Nobody touches your P&L.",
  intro:
    "When a position closes, the contract reads four values and updates your balance in the same transaction.",
  cards: [
    { title: "Opening price", body: "Recorded when the position opened." },
    {
      title: "Closing price",
      body: "From the price feed at the moment of close.",
    },
    { title: "Position size", body: "Your lots and the leverage you chose." },
    {
      title: "Costs",
      body: "Spread, swap and commission, shown before you confirm.",
    },
  ],
  note: "Margin releases. Balance updates. Free balance becomes withdrawable. No dealer intervention, no manual adjustment, no “we're reviewing your trade.”",
} as const;

export const tradingModes = {
  eyebrow: "Trading modes",
  heading: "Two ways to trade. Same rules either way.",
  intro:
    "Pick per position, not per account — and see the full cost of either choice before you confirm.",
  label: "Flexible trading",
  modes: [
    {
      index: "01",
      title: "Fully funded",
      body: "Trade your own capital, no borrowing. Margin equals position value, so nothing is amplified — in either direction.",
      points: [
        "No overnight financing",
        "Risk is exactly what you see",
        "Best for building consistency",
      ],
    },
    {
      index: "02",
      title: "Leveraged",
      body: "Choose leverage per position. More exposure from less locked margin — and bigger losses when it goes against you.",
      points: [
        "Adjustable up to 1:200",
        "Costs apply only when leverage is used",
        "Full cost shown before you confirm",
      ],
    },
  ],
  note: "CFDs are leveraged products. You can lose more than you allocate.",
  image: "/assets/sections/card.jpg",
  imageAlt: "An fxartha gold card handed across a marble counter",
} as const;

export const tradeInsurance = {
  eyebrow: "Trade insurance",
  heading: "Switch on a cushion before you enter.",
  intro:
    "Choose a tier before placing an eligible trade. If it goes against you, the contract covers part of the loss up to the cap. No hedging, no separate account, no claim form.",
  tiers: [
    { tier: "Minimal", cover: "15%", cap: "$250" },
    { tier: "Standard", cover: "30%", cap: "$750" },
    { tier: "Advanced", cover: "50%", cap: "$2,000" },
    { tier: "Max", cover: "75%", cap: "$5,000" },
  ],
  activateTitle: "Activate before placing a trade",
  activateBody:
    "Toggle cover on the ticket of any eligible trade. The premium is shown before you confirm; the payout is automatic at close.",
  points: ["Partial loss coverage", "Automatic payout at close", "No claim form"],
  cta: "Explore trade protection",
  ctaHref: "/protection",
  footnote: "Applicable on eligible trades · Trade conditions apply",
  faq: [
    {
      question: "Who pays for the cover?",
      answer:
        "An insurance pool funded by a share of platform trading fees. The pool sits on-chain and its balance is publicly visible.",
    },
    {
      question: "What does it cost me?",
      answer:
        "A per-trade premium in Platform Credits, priced by tier and position size — shown on the ticket before you confirm.",
    },
    {
      question: "Which trades qualify?",
      answer:
        "Eligible instruments carry an insurable badge. Instrument list, minimum hold time and per-day limits are published in-app.",
    },
    {
      question: "When does it pay out?",
      answer:
        "Automatically at close, in the same settlement transaction as your P&L. Nothing to file.",
    },
  ],
  quote: "Trade with awareness. Not uncertainty.",
} as const;

export const rewards = {
  eyebrow: "XP · Performance Score · Platform Credits",
  heading: "We reward how you trade, not how much you deposit.",
  /** The former hero art, framed as cards flanking the pinned slide. */
  art: [
    { src: "/assets/hero/hero-standing.jpg" },
    { src: "/assets/hero/hero-portrait.png" },
  ],
  intro:
    "Every broker gives its best spreads to its biggest deposits. We give them to traders who show discipline. Your terms improve by doing the things a good trader already does.",
  label: "Rewards",
  cards: [
    {
      kicker: "Earn it",
      badge: "XP",
      body: "Goes up when you trade consistently, complete education, keep risk under control, refer traders, join challenges.",
    },
    {
      kicker: "Prove it",
      badge: "Performance Score",
      body: "Built from risk management, win rate, consistency, education and discipline. Account size is not an input.",
    },
    {
      kicker: "Spend it",
      badge: "Platform Credits",
      body: "Insurance premiums, competition entries, premium tools, AI analysis, education, marketplace.",
    },
  ],
  ladderTitle: "As XP rises",
  ladder: [
    { area: "Spread", change: "Tighter spreads at every level" },
    { area: "Swap", change: "Reduced overnight financing" },
    { area: "Commission", change: "Lower per-lot commission" },
    { area: "Insurance", change: "Higher coverage tiers unlocked" },
    { area: "Staking", change: "Better reward rate" },
    { area: "Support", change: "Priority desk access" },
  ],
  activityTitle: "Activity rewards",
  activityBody:
    "Trade, earn credits, redeem a spin. Prizes are trading-related: spread rebates, insurance vouchers, TradingView subscriptions, hardware, event tickets.",
  activityNote:
    "Credits are earned through activity — never bought with a deposit.",
  quote: "Better terms are earned, not bought.",
} as const;

export const copyTrading = {
  eyebrow: "Copy trading",
  headlineLines: ["Follow a track record", "you can actually verify"],
  intro:
    "Every published result is generated on-platform and auditable — not a screenshot, not a self-reported number. Pick a trader, copy at your own size, set your own risk cap, pause any time.",
  avatars: ["AQ", "NS", "ST", "OF"],
  features: [
    {
      title: "Verifiable history",
      body: "Every trade in the record was executed here. Profiles lead with months of history and max drawdown — drawdown first.",
    },
    {
      title: "Your size, your risk",
      body: "Set allocation and a maximum drawdown per copied trader. Copying stops automatically at the cap.",
    },
    {
      title: "Pause instantly",
      body: "Stop copying without closing your account or touching the rest of your balance.",
    },
  ],
  disclaimer:
    "Copying another trader does not reduce risk. Past performance does not predict future results.",
  quote: "Strategy over speculation.",
} as const;

export const staking = {
  eyebrow: "Staking",
  heading: "Idle capital shouldn't sit idle.",
  intro:
    "Between setups, your unallocated balance does nothing on a normal broker. Stake it here and it earns while staying inside the ecosystem.",
  flow: "Stake → Earn → Trade with utility",
  steps: ["Stake", "Earn", "Trade with utility"],
  body: "Staking rewards convert into trading utility, so you're not choosing between earning and being ready to trade. Duration options and the reward rate are shown before you commit.",
  points: [
    "Flexible and fixed lock durations",
    "Reward rate shown before you stake",
    "Rewards convert into trading utility",
  ],
  note: "Rates and lock terms vary by duration. Staking carries its own risks and is not a guaranteed return. See full terms.",
  footnote: "Stake, earn, and trade with utility across the FX Artha ecosystem",
  image: "/assets/sections/staking.jpg",
  imageAlt: "A gold hourglass pouring coins into a city skyline",
  quote: "Make your assets work beyond holding.",
} as const;

export const referral = {
  eyebrow: "Partners",
  heading: "Earn from traders you actually bring in.",
  intro:
    "Rewards are tied to real trading activity, not recruitment depth. No tiers below tiers, no volume quotas from someone else's downline.",
  body: "Bring traders you believe in; when they trade, you earn. Partner tooling scales from a referral link to a full IB desk.",
  points: [
    "Activity-based rewards",
    "Partner-level tools and reporting",
    "IB management dashboard",
  ],
  note: "Advanced features available through partner onboarding.",
  cta: "Become a partner",
  footnote: "Grow with the FX Artha partner program",
  quote: "Growth driven by participation, not promises.",
} as const;

export const whyArtha = {
  id: "why",
  eyebrow: "Why traders choose FX Artha",
  heading: "Five things a traditional broker can't say.",
  cards: [
    {
      kicker: "01",
      title: "We never hold your money",
      body: "Funds sit in a contract, not our balance sheet.",
    },
    {
      kicker: "02",
      title: "Only your margin is locked",
      body: "Free balance is withdrawable mid-trade, at any hour.",
    },
    {
      kicker: "03",
      title: "Settlement is automatic",
      body: "No dealer between you and your P&L.",
    },
    {
      kicker: "04",
      title: "Losses can be partly insured",
      body: "Switch on cover before you enter, up to 75%.",
    },
    {
      kicker: "05",
      title: "Better terms are earned, not bought",
      body: "Discipline lowers your spread. Deposit size doesn't.",
    },
  ],
} as const;

export const finalCta = {
  eyebrow: "Final step",
  heading: "Your money. Your control. Automatic settlement.",
  intro: "Open an account in minutes, or test everything on a demo first.",
  primaryCta: "Open account",
  secondaryCta: "Try the demo",
  disclaimer:
    "FX Artha is a protocol-driven trading ecosystem with automated settlement. Funds stay under your control; execution and settlement run on system-defined logic.",
} as const;

export const introContent = {
  src: "/assets/intro/fxartha-intro.mp4",
  label: "FX Artha opening film",
  skip: "Skip",
  soundOn: "Sound on",
  soundOff: "Sound off",
} as const;
