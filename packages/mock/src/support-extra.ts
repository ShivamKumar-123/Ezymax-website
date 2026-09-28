import { PEOPLE } from "./people";

export const SUPPORT_AGENT = { ...PEOPLE[8]!, role: "Senior Client Support", languages: ["English", "Mandarin", "Malay"] };

export const HELP_CATEGORIES = [
  { key: "deposits", title: "Deposits", icon: "money_with_wings", articles: 18, text: "USDT TRC20, confirmations, limits" },
  { key: "withdrawals", title: "Withdrawals", icon: "dollar_banknote", articles: 14, text: "Processing times, fees, whitelists" },
  { key: "accounts", title: "Accounts", icon: "laptop", articles: 22, text: "Live, demo, leverage, MT5 access" },
  { key: "verification", title: "Verification", icon: "identification_card", articles: 11, text: "KYC documents, proof of address" },
  { key: "trading", title: "Trading", icon: "chart_increasing", articles: 31, text: "Spreads, swaps, margin, stop-out" },
  { key: "partners", title: "Partners", icon: "handshake", articles: 16, text: "IB commissions, links, payouts" },
];

export const POPULAR_ARTICLES = [
  { id: "a1", title: "How long does a USDT (TRC20) withdrawal take?", category: "Withdrawals", views: "48.2K" },
  { id: "a2", title: "Why does my deposit show 12/20 confirmations?", category: "Deposits", views: "31.7K" },
  { id: "a3", title: "Hedging vs netting accounts: which should I choose?", category: "Accounts", views: "22.4K" },
  { id: "a4", title: "What documents are accepted as proof of address?", category: "Verification", views: "19.9K" },
  { id: "a5", title: "How are swaps calculated and when is triple swap charged?", category: "Trading", views: "17.3K" },
  { id: "a6", title: "When are IB commissions paid out?", category: "Partners", views: "12.1K" },
];

export const QUICK_REPLIES = ["Withdrawal status", "Deposit not credited", "Change leverage", "Swap-free account", "Talk to a human"];

/** Canned but relevant bot answers keyed by intent. */
export function botAnswer(q: string): { text: string; handoff?: boolean } {
  const s = q.toLowerCase();
  if (/(human|agent|person|someone|operator)/.test(s)) return { text: "Sure, I'm connecting you to a support specialist now. Average wait is under 1 minute.", handoff: true };
  if (/withdraw/.test(s)) return { text: "Withdrawals to USDT (TRC20) are processed automatically within 15 minutes, 24/7. I can see your latest withdrawal TX904375 of 2,500.00 USDT is **processing** and was approved by our risk check 6 minutes ago. The network fee is 1 USDT." };
  if (/deposit|credited|confirm/.test(s)) return { text: "USDT TRC20 deposits are credited after 20 network confirmations (about 1 minute). Your last deposit TX904412 has 12/20 confirmations and will be credited to your wallet automatically. No action is needed." };
  if (/leverage/.test(s)) return { text: "You can change leverage on any live account from Accounts → ⋯ → Change leverage. Account 80412337 (Pro) supports up to 1:500. Changes apply instantly if you have no open positions." };
  if (/swap|islamic/.test(s)) return { text: "Swap-free is available on Standard and Pro accounts. Account 80412512 is already swap-free. To convert another account, open Accounts → ⋯ → Request swap-free; approval takes about 1 business day." };
  if (/kyc|verif|document|address/.test(s)) return { text: "Your proof of address is under review, usually within 2 hours. Accepted documents: a utility bill, bank statement or government letter issued in the last 3 months showing your full name and address." };
  if (/spread|commission|fee/.test(s)) return { text: "Pro accounts have spreads from 0.3 pips with no commission. ECN starts at 0.0 pips plus $3.50 per lot per side. You can see every charge you've paid under Portfolio → Ledger." };
  if (/partner|ib|commission|referral/.test(s)) return { text: "IB commissions are calculated in real time and paid out daily at 00:05 server time (GMT+3) to your wallet. You have $1,488.20 available and $212.40 pending." };
  return { text: "Thanks! I've checked our help centre. Here's what I found: you can manage this from the relevant section of your Client Area. Would you like me to connect you with a specialist for more detail?" };
}

export function agentAnswer(q: string): string {
  const s = q.toLowerCase();
  if (/thank/.test(s)) return "You're welcome, Arjun! Is there anything else I can help you with today?";
  if (/withdraw/.test(s)) return "I've checked with our payments desk: TX904375 was broadcast to the TRON network a moment ago. You should see the funds in your external wallet within 2–3 minutes.";
  if (/deposit/.test(s)) return "I can see the deposit on-chain. It's at 17/20 confirmations now and will credit automatically. I'll stay on the chat until it lands.";
  const b = botAnswer(q);
  if (!b.handoff && !b.text.startsWith("Thanks! I've checked")) return `Good question. ${b.text} Anything else I can check for you?`;
  return "Understood. Let me look into that for you. I've added a note to your profile so any colleague can pick this up too.";
}
