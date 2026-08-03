/**
 * /company copy. Components never import this directly — the view passes it
 * down as props (component-conventions.md → "Data rules").
 */

export const companyHero = {
  eyebrow: "Company",
  heading: "Built so you don't have to trust us.",
  intro:
    "FX Artha is a protocol-driven trading ecosystem with automated settlement. Funds stay under your control; execution and settlement run on system-defined logic.",
  backLabel: "Back to home",
} as const;

export const companyAbout = {
  id: "about",
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

export const companyProtocol = {
  id: "protocol",
  eyebrow: "Where your money actually sits",
  heading: "Your broker's balance sheet, or a contract you control.",
  intro:
    "With a normal broker, your deposit lands in their bank account and they decide when you get it back. FX Artha removes that step entirely: the contract locks margin when you open a position, settles P&L when you close it, and releases your free balance whenever you ask. Nobody approves anything.",
  cards: [
    {
      title: "A traditional broker",
      points: [
        "You deposit",
        "Money enters the broker's bank account",
        "The broker controls your full balance",
        "You request a withdrawal",
        "Compliance review → finance batch → next business day",
        "The broker approves",
        "You get paid",
      ],
      footnote: "Every step depends on trusting the broker.",
    },
    {
      title: "FX Artha",
      points: [
        "You allocate from your wallet",
        "Funds enter the trading contract",
        "Only margin for open trades is locked",
        "Trade executes",
        "Profit credited, loss deducted — automatically",
        "Idle balance stays yours the whole time",
        "Withdraw whenever you want",
      ],
      footnote: "No custody. No permission step.",
    },
  ],
  quote: "Control stays with you. Execution stays with the system.",
} as const;

export const companyLegal = {
  id: "legal",
  eyebrow: "Legal structure",
  heading: "One positioning. Used everywhere.",
  body: [
    "FX Artha is not a broker holding client money. It is a protocol-driven trading ecosystem: FX Artha Ltd. operates the protocol, the platform and this website, while trade execution and liquidity are provided through licensed execution partners — the partner serving your region is named in your account documents.",
    "Client funds are never held by FX Artha Ltd. They remain in the on-chain trading contract, allocated from your own wallet, with only open-trade margin locked. Jurisdictions where CFD trading is restricted are excluded from onboarding; the current list is published in the Terms of Service.",
  ],
  note: "Withdrawal of free balance is executed by the trading contract under published platform rules and applicable legal and compliance requirements.",
} as const;

export const companyContact = {
  id: "contact",
  eyebrow: "Contact",
  heading: "Talk to a human.",
  body: [
    "Questions about the contract, onboarding, partnerships or anything else — write to us and a real person replies within one business day.",
  ],
  note: "support@fxartha.com",
  cta: "Contact us",
} as const;
