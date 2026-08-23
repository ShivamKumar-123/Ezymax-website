/**
 * Support assistant knowledge base — FIXED, curated answers (no LLM).
 *
 * The in-app support chat walks the user section → question → answer. Free
 * text typed into the composer is matched against `keywords` (and the
 * question wording) with `findAnswers()`; anything it can't match is handed
 * to a human via a support ticket.
 *
 * Keep answers short, concrete and about THIS platform. When a flow changes
 * in the app, update the matching answer here — this file is the single
 * source of truth for what the bot says.
 */

export type KbLink = { label: string; href: string };

export type KbAnswer = {
  id: string;
  /** The question as shown on the chip / in the user bubble. */
  q: string;
  /** Fixed answer. `\n` starts a new paragraph; lines starting with "• " render as bullets. */
  a: string;
  /** Lower-case words/phrases that should route free text to this answer. */
  keywords: string[];
  links?: KbLink[];
};

export type KbSection = {
  id: string;
  title: string;
  emoji: string;
  /** Category sent with the support ticket when escalating from this section. */
  ticketCategory: string;
  items: KbAnswer[];
};

export const SUPPORT_KB: KbSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    emoji: '🚀',
    ticketCategory: 'Account',
    items: [
      {
        id: 'gs-first-steps',
        q: 'How do I get set up after signing up?',
        a: 'Three steps and you are trading:\n• Open an account — Accounts → Open account (demo to practise, real to trade with funds).\n• Fund it — Funds → Deposit (real accounts only).\n• Trade — Home → Terminal, or the Trade button on any account card.\nComplete KYC in Profile → KYC whenever you are ready; it is only required before your first withdrawal.',
        keywords: ['get started', 'getting started', 'setup', 'set up', 'first steps', 'new here', 'how to start', 'begin', 'onboarding'],
        links: [{ label: 'Open an account', href: '/accounts' }, { label: 'Deposit', href: '/wallet' }],
      },
      {
        id: 'gs-demo-vs-real',
        q: 'What is the difference between a demo and a real account?',
        a: 'A demo account trades with virtual money on live prices — perfect for learning the terminal with zero risk. A real account trades with your deposited funds.\nDemo accounts cannot deposit, withdraw or transfer funds. Everything else (terminal, AI strategies, charts) works the same on both.',
        keywords: ['demo', 'practice', 'virtual', 'real account', 'live account', 'difference'],
      },
      {
        id: 'gs-navigate',
        q: 'Where do I find everything in the dashboard?',
        a: 'The floating dock at the top is your map:\n• Home — balances, shortcuts, open trades, market movers and news.\n• Accounts — open, switch and manage trading accounts.\n• Funds — deposits, withdrawals and transaction history.\n• Social — copy trading and PAMM.\n• Affiliates — your referral programme.\n• AI Strategies — build and backtest strategies by chatting.\n• Profile — personal details, KYC, security and sessions.\nThe Deposit pill and the sun/moon theme toggle sit on the right.',
        keywords: ['navigate', 'where', 'find', 'menu', 'dashboard', 'dock', 'navbar', 'sections'],
      },
      {
        id: 'gs-dark-mode',
        q: 'How do I switch to dark mode?',
        a: 'Click the sun/moon button in the top-right of the dashboard. The trading terminal is always dark. Your choice is remembered on this device.',
        keywords: ['dark mode', 'light mode', 'theme', 'dark theme', 'night'],
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Trading accounts',
    emoji: '💼',
    ticketCategory: 'Account',
    items: [
      {
        id: 'acc-open',
        q: 'How do I open a new trading account?',
        a: 'Go to Accounts and click Open account.\n• Choose Demo or Real.\n• Pick an account type — each shows its markets, minimum deposit and maximum leverage.\n• Choose your leverage (from 1:1 up to the type\'s maximum, 1:2000 at most).\nThe account appears on your Accounts page immediately with its number (PT…).',
        keywords: ['open account', 'new account', 'create account', 'add account', 'another account', 'account type'],
        links: [{ label: 'Go to Accounts', href: '/accounts' }],
      },
      {
        id: 'acc-limit',
        q: 'How many accounts can I have?',
        a: 'You can open up to 5 accounts yourself. Need more? Ask support and we will raise the limit for you.\nTry-with-demo logins are limited to a single demo account.',
        keywords: ['how many accounts', 'account limit', 'maximum accounts', 'more accounts', 'limit'],
      },
      {
        id: 'acc-leverage',
        q: 'How do I change the leverage on my account?',
        a: 'Open the terminal for that account: the Trade ticket shows a Leverage row with a picker — choose the new value and it applies to that account right away. Leverage cannot exceed the maximum allowed for the account type.\nHigher leverage means a smaller margin per trade but larger swings in equity.',
        keywords: ['leverage', 'change leverage', '1:100', '1:500', 'margin requirement'],
      },
      {
        id: 'acc-switch',
        q: 'How do I switch between accounts?',
        a: 'On Home, click the account number in the account card (the REAL / DEMO pill) and pick another account. The balance, equity and Trade button update to that account. The terminal is opened per account, so each account has its own terminal tab.',
        keywords: ['switch account', 'change account', 'select account', 'active account'],
      },
      {
        id: 'acc-equity',
        q: 'What do Balance, Equity, Free margin and Margin level mean?',
        a: '• Balance — cash in the account, not counting open trades.\n• Equity — balance plus/minus the floating profit of open trades.\n• Margin used — the deposit locked by your open positions.\n• Free margin — equity minus margin used; what you can still open trades with.\n• Margin level — equity ÷ margin used, as a percentage. Keep it comfortably high to avoid a margin call.',
        keywords: ['equity', 'balance', 'free margin', 'margin level', 'margin used', 'what does', 'meaning'],
      },
    ],
  },
  {
    id: 'deposits',
    title: 'Deposits',
    emoji: '💳',
    ticketCategory: 'Deposits',
    items: [
      {
        id: 'dep-how',
        q: 'How do I deposit funds?',
        a: 'Funds → Deposit (or the Deposit pill at the top).\n• Choose the account to fund and the amount.\n• Pick a method: Bank transfer / UPI / QR, or Crypto (BTC, ETH, USDT).\n• Follow the on-screen instructions for that method.\nDeposits show in Funds → History with their status (pending → completed).',
        keywords: ['deposit', 'fund', 'add money', 'add funds', 'top up', 'how to deposit', 'pay'],
        links: [{ label: 'Deposit now', href: '/wallet' }],
      },
      {
        id: 'dep-methods',
        q: 'Which deposit methods are available?',
        a: '• Bank transfer, UPI and QR code — local payments. Submit the request; finance reviews it and sends you payment details or a payment link, or you pay to the details shown and upload your proof.\n• Crypto — BTC, ETH or USDT through our payment processor; credited automatically after network confirmations.\nThe methods enabled for your region are the ones you see on the Deposit page.',
        keywords: ['deposit methods', 'payment methods', 'bank transfer', 'upi', 'qr', 'crypto deposit', 'usdt', 'bitcoin', 'card'],
      },
      {
        id: 'dep-min',
        q: 'What is the minimum deposit?',
        a: 'It depends on the account type — the minimum is shown when you open an account (Accounts → Open account → account type card). There is no platform-wide minimum beyond that.',
        keywords: ['minimum deposit', 'min deposit', 'smallest deposit', 'how much'],
      },
      {
        id: 'dep-time',
        q: 'How long does a deposit take?',
        a: '• Crypto — usually within minutes once the network confirms the transaction.\n• Bank / UPI / QR — reviewed by finance; typically the same business day after your payment is received.\nIf a deposit shows pending for longer than that, send us the transaction reference via Talk to a human below and we will trace it.',
        keywords: ['deposit pending', 'deposit time', 'how long deposit', 'not credited', 'deposit not showing', 'still pending'],
      },
      {
        id: 'dep-demo',
        q: 'Why can\'t I deposit to my demo account?',
        a: 'Demo accounts use virtual funds and cannot deposit, withdraw or transfer. Open a real account (Accounts → Open account → Real) to use wallet funding.',
        keywords: ['demo deposit', 'cannot deposit', "can't deposit", 'deposit disabled'],
      },
    ],
  },
  {
    id: 'withdrawals',
    title: 'Withdrawals',
    emoji: '🏦',
    ticketCategory: 'Withdrawals',
    items: [
      {
        id: 'wd-how',
        q: 'How do I withdraw funds?',
        a: 'Funds → Withdraw.\n• Choose the account, amount and payout method (bank or crypto/USDT).\n• Submit — the request appears in Funds → History.\nYou can only withdraw free margin; funds locked by open trades are not available until those trades close.',
        keywords: ['withdraw', 'withdrawal', 'cash out', 'take money out', 'payout'],
        links: [{ label: 'Withdraw', href: '/wallet' }],
      },
      {
        id: 'wd-kyc',
        q: 'Why does it say I need KYC to withdraw?',
        a: 'Withdrawals are the one hard KYC gate on the platform. Complete verification in Profile → KYC (ID, proof of address, selfie). Once approved, withdrawal requests go through normally.',
        keywords: ['kyc to withdraw', 'withdraw kyc', 'verify to withdraw', 'complete kyc verification'],
        links: [{ label: 'Go to KYC', href: '/profile' }],
      },
      {
        id: 'wd-time',
        q: 'How long do withdrawals take?',
        a: '• Crypto / USDT — reviewed by finance; most requests are processed within 24 hours.\n• Bank — processed within a few business days depending on your bank.\nYou will see the status change in Funds → History. If it is still pending after that window, escalate below with the request date.',
        keywords: ['withdrawal time', 'how long withdrawal', 'withdrawal pending', 'withdrawal not received', 'processing'],
      },
      {
        id: 'wd-rejected',
        q: 'My withdrawal was rejected — what now?',
        a: 'The most common reasons: KYC not yet approved, the amount exceeded free margin, or payout details that did not match your verified name. Check Funds → History for the note on the request, fix the detail, and submit again. If it is unclear, talk to a human below and include the request ID.',
        keywords: ['withdrawal rejected', 'rejected', 'declined', 'failed withdrawal'],
      },
    ],
  },
  {
    id: 'kyc',
    title: 'KYC verification',
    emoji: '🪪',
    ticketCategory: 'KYC',
    items: [
      {
        id: 'kyc-docs',
        q: 'What documents do I need for KYC?',
        a: '• Government ID — passport, national ID or driving licence (front and back).\n• Proof of address — utility bill or bank statement issued within the last 3 months.\n• Selfie — a quick photo to match you to your ID.\nUpload them in Profile → KYC. Clear, uncropped photos get approved fastest.',
        keywords: ['kyc', 'documents', 'verification', 'verify identity', 'id proof', 'proof of address', 'passport', 'selfie'],
        links: [{ label: 'Start KYC', href: '/profile' }],
      },
      {
        id: 'kyc-time',
        q: 'How long does KYC review take?',
        a: 'Usually within 1–2 business days. Your status in Profile → KYC changes from Pending to Approved (or shows what needs re-uploading). Withdrawals unlock as soon as it is approved.',
        keywords: ['kyc time', 'kyc pending', 'how long kyc', 'kyc status', 'still pending kyc'],
      },
      {
        id: 'kyc-rejected',
        q: 'My KYC was rejected. Why?',
        a: 'Typical causes: blurry or cropped photos, an expired ID, a proof of address older than 3 months, or a name that does not match your profile. Profile → KYC shows the reason; re-upload the corrected document and it goes back into review.',
        keywords: ['kyc rejected', 'kyc failed', 'verification rejected', 'resubmit'],
      },
    ],
  },
  {
    id: 'terminal',
    title: 'Trading terminal',
    emoji: '📈',
    ticketCategory: 'Trading',
    items: [
      {
        id: 'tt-open',
        q: 'How do I open the trading terminal?',
        a: 'Home → Terminal shortcut, or the Trade button on any account card. The terminal opens for that account in a new tab with the chart in the middle, your positions below, and the Markets / Trade panel on the right.',
        keywords: ['terminal', 'open terminal', 'trade screen', 'chart', 'trading platform', 'webtrader'],
        links: [{ label: 'Home', href: '/dashboard' }],
      },
      {
        id: 'tt-instrument',
        q: 'How do I find and pick an instrument?',
        a: 'Click Markets (top-right of the terminal). Use the search box or the tabs (Watchlist, Crypto, Forex, Indices, Metals, Shares…). Click an instrument and the Trade ticket opens for it; tap the ★ to add it to your Watchlist. The strip at the very top is your own quick list — use the + to add instruments to it.',
        keywords: ['instrument', 'symbol', 'find pair', 'search', 'markets', 'watchlist', 'favourite', 'ticker'],
      },
      {
        id: 'tt-order',
        q: 'How do I place a trade?',
        a: 'In the Trade ticket:\n• Choose Market (fills now) or Limit / Stop / Stop-Limit (fills at your price).\n• Set the Volume in lots (use − / + or the slider).\n• Tick TP/SL to add a take-profit and stop-loss.\n• Press Buy or Sell. The Margin row shows exactly what the trade will lock.\nOpen trades appear in Positions at the bottom; close them from there.',
        keywords: ['place trade', 'buy', 'sell', 'order', 'market order', 'limit order', 'stop order', 'lots', 'volume', 'take profit', 'stop loss', 'tp', 'sl'],
      },
      {
        id: 'tt-button-disabled',
        q: 'Why is the Buy / Sell button disabled?',
        a: 'One of these is true:\n• The market is closed for that instrument (status shows CLOSED).\n• Free margin is too low for the chosen volume — reduce lots or deposit.\n• A pending order\'s price is on the wrong side of the market.\n• No account is selected.\nFix the highlighted field and the button enables again.',
        keywords: ['button disabled', 'cannot trade', "can't trade", 'greyed out', 'not enough margin', 'market closed', 'insufficient'],
      },
      {
        id: 'tt-no-feed',
        q: 'An instrument shows "—" or no live feed. Why?',
        a: 'That instrument is not quoted right now — either its market is closed (forex and indices are closed over the weekend) or it is not enabled on this environment. Pick an instrument marked live in Markets; the chart offers a one-click switch to a quoted symbol.',
        keywords: ['no feed', 'no price', 'no data', 'chart empty', 'dash', 'not updating', 'price missing'],
      },
      {
        id: 'tt-news',
        q: 'Where are market news and the economic calendar?',
        a: 'Left rail of the terminal → News. The News tab shows live headlines with images (Forex, Crypto, Commodities, Markets); the Calendar tab shows this week\'s Forex Factory economic events with impact levels. Home also has a world-markets map with news by region.',
        keywords: ['news', 'calendar', 'economic calendar', 'forex factory', 'events'],
      },
      {
        id: 'tt-calc',
        q: 'How do I calculate margin or position size?',
        a: 'Left rail → Risk calculator. Tabs for Margin, P&L, Lot size (from risk % and stop-loss) and Swap. It uses the live price of the selected instrument and your account\'s leverage.',
        keywords: ['calculator', 'risk calculator', 'position size', 'lot size calculator', 'margin calculator', 'pip value'],
      },
    ],
  },
  {
    id: 'ai-strategies',
    title: 'AI Strategies',
    emoji: '🤖',
    ticketCategory: 'Technical',
    items: [
      {
        id: 'ai-build',
        q: 'How do I build a strategy with AI?',
        a: 'Click AI Strategies in the dock — the builder chat opens. Describe what you want in plain language ("buy EURUSD when RSI is below 30 on the 1h chart, 2% stop"). The assistant turns it into rules you can see on the right; refine by replying. Press Save to keep it.',
        keywords: ['ai strategy', 'ai strategies', 'build strategy', 'strategy builder', 'create strategy', 'bot strategy'],
        links: [{ label: 'Open the builder', href: '/ai-strategies/new' }],
      },
      {
        id: 'ai-backtest',
        q: 'How do I backtest or deploy a strategy?',
        a: 'From the builder click All strategies (or go to My Strategies). Each card has Backtest (runs on historical bars and shows ROI), Deploy (runs it on a chosen account), Pause, Rename and Delete. Results update on the card.',
        keywords: ['backtest', 'deploy', 'run strategy', 'pause strategy', 'my strategies', 'roi'],
        links: [{ label: 'My Strategies', href: '/ai-strategies' }],
      },
    ],
  },
  {
    id: 'copy-trading',
    title: 'Copy trading & PAMM',
    emoji: '👥',
    ticketCategory: 'Trading',
    items: [
      {
        id: 'ct-follow',
        q: 'How do I copy another trader?',
        a: 'Social → Copy Trading. Open a provider to see their performance, performance fee and minimum investment, then click Follow, choose the account to copy with and your allocation (at or above the provider\'s minimum). Their trades are mirrored to your account proportionally. Stop following at any time from the same page.',
        keywords: ['copy trading', 'copy trader', 'follow', 'social trading', 'mirror trades', 'provider', 'allocation'],
        links: [{ label: 'Copy Trading', href: '/social' }],
      },
      {
        id: 'ct-pamm',
        q: 'What is PAMM?',
        a: 'PAMM lets a money manager trade a pooled account; your share of profit and loss is proportional to what you invested, minus the manager\'s performance fee. Find managers under Social → PAMM and click Follow Manager to invest.',
        keywords: ['pamm', 'managed account', 'money manager', 'invest with manager'],
        links: [{ label: 'PAMM', href: '/pamm' }],
      },
    ],
  },
  {
    id: 'profile',
    title: 'Profile & security',
    emoji: '🔐',
    ticketCategory: 'Account',
    items: [
      {
        id: 'pr-edit',
        q: 'How do I update my name, photo or details?',
        a: 'Profile → Personal. Click the avatar to upload a photo, edit your details and save. Your name must match your KYC documents.',
        keywords: ['profile', 'avatar', 'photo', 'change name', 'update details', 'personal info'],
        links: [{ label: 'Profile', href: '/profile' }],
      },
      {
        id: 'pr-password',
        q: 'How do I change my password or log out other devices?',
        a: 'Profile → Security to change your password. Profile → Sessions lists every device signed in to your account — end any session you do not recognise. Forgot your password? Use Forgot password on the login page to get a reset email.',
        keywords: ['password', 'change password', 'reset password', 'forgot password', 'sessions', 'log out devices', 'security'],
      },
      {
        id: 'pr-2fa',
        q: 'Can I enable two-factor authentication?',
        a: 'Two-factor authentication (authenticator app) is being finished and will appear under Profile → Security when it is live. Until then, use a strong unique password and review Profile → Sessions regularly.',
        keywords: ['2fa', 'two factor', 'two-factor', 'authenticator', 'otp'],
      },
    ],
  },
];

export const KB_SECTION_BY_ID: Record<string, KbSection> = Object.fromEntries(SUPPORT_KB.map((s) => [s.id, s]));

export function sectionForAnswer(answerId: string): KbSection | undefined {
  return SUPPORT_KB.find((s) => s.items.some((i) => i.id === answerId));
}

const STOP = new Set(['the', 'a', 'an', 'to', 'i', 'my', 'is', 'it', 'do', 'how', 'can', 'what', 'why', 'of', 'in', 'on', 'for', 'and', 'me', 'you', 'be', 'are', 'does', 'with', 'not', 'want', 'please', 'help']);

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9%:\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
}

/** Rank fixed answers for a free-text query. Returns the best matches (max 3)
 *  or an empty array when nothing is a confident hit. */
export function findAnswers(query: string): { answer: KbAnswer; section: KbSection; score: number }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const qTokens = new Set(tokens(q));
  const scored: { answer: KbAnswer; section: KbSection; score: number }[] = [];
  for (const section of SUPPORT_KB) {
    for (const answer of section.items) {
      let score = 0;
      for (const kw of answer.keywords) {
        if (q.includes(kw)) score += kw.includes(' ') ? 3 : 2;
      }
      for (const t of tokens(answer.q)) if (qTokens.has(t)) score += 1;
      if (score > 0) scored.push({ answer, section, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 2) return [];
  return scored.filter((s) => s.score >= Math.max(2, best.score * 0.5)).slice(0, 3);
}
