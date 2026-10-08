/* Mock data — Back Office · Support (inbox, AI knowledge base, canned replies, CSAT). Prefix: SUP_ */
import { PEOPLE, person, type Person } from "./people";
import { seeded } from "./rng";

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

export type SupAgentStatus = "online" | "away" | "offline";
export interface SupAgent {
  id: string;
  person: Person;
  role: string;
  status: SupAgentStatus;
  languages: string[];
  open: number;
  csat: number; // %
  frt: number; // first response seconds
  resolved: number; // 30d
  aiAssist: number; // % of replies drafted with AI
}

export const SUP_AGENTS: SupAgent[] = [
  { id: "ag_priya", person: PEOPLE[4]!, role: "Risk Manager · Tier 3", status: "online", languages: ["EN", "HI", "ML"], open: 6, csat: 97.1, frt: 38, resolved: 412, aiAssist: 64 },
  { id: "ag_mei", person: PEOPLE[8]!, role: "Senior Client Support", status: "online", languages: ["EN", "ZH", "MS"], open: 9, csat: 96.4, frt: 41, resolved: 588, aiAssist: 71 },
  { id: "ag_omar", person: PEOPLE[5]!, role: "Client Support · MENA", status: "online", languages: ["AR", "EN"], open: 7, csat: 94.8, frt: 52, resolved: 503, aiAssist: 58 },
  { id: "ag_elena", person: PEOPLE[12]!, role: "Finance Support", status: "away", languages: ["EN", "RU", "EL"], open: 4, csat: 95.9, frt: 63, resolved: 367, aiAssist: 49 },
  { id: "ag_carlos", person: PEOPLE[11]!, role: "Client Support · LATAM", status: "online", languages: ["ES", "PT", "EN"], open: 8, csat: 93.2, frt: 57, resolved: 461, aiAssist: 66 },
  { id: "ag_zara", person: PEOPLE[18]!, role: "KYC Specialist", status: "offline", languages: ["EN", "UR"], open: 2, csat: 92.6, frt: 74, resolved: 298, aiAssist: 42 },
  { id: "ag_kwame", person: PEOPLE[17]!, role: "Client Support · Africa", status: "online", languages: ["EN", "FR"], open: 5, csat: 91.8, frt: 69, resolved: 344, aiAssist: 55 },
];

export const SUP_ME = SUP_AGENTS[0]!;

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

export type SupChannel = "web" | "app" | "whatsapp" | "email";
export type SupConvStatus = "ai" | "needs_agent" | "agent" | "resolved";
export type SupMsgFrom = "client" | "ai" | "agent" | "note" | "handoff" | "system";

export interface SupMessage {
  id: string;
  from: SupMsgFrom;
  text: string;
  time: string; // HH:mm GMT+3
  author?: string; // agent name for agent/note/handoff
  authorPhoto?: string;
  cites?: string[]; // KB article titles the AI used
  confidence?: number; // AI confidence 0-100
  attachment?: { name: string; size: string };
}

export interface SupAccount {
  login: string;
  type: "live" | "demo";
  group: string;
  equity: number;
  currency?: string;
}

export interface SupContext {
  kyc: "verified" | "pending" | "rejected" | "review";
  segment: string;
  tenant: string;
  since: string;
  accounts: SupAccount[];
  wallet: number;
  lastDeposit: { amount: number; method: string; at: string };
  lastWithdrawal?: { amount: number; status: string; at: string; id: string };
  openTickets: { id: string; title: string; status: string }[];
  aiSummary: string;
  sentiment: "positive" | "neutral" | "frustrated";
  ltv: number;
  tags: string[];
  language: string;
  device: string;
}

export interface SupConversation {
  id: string;
  client: Person;
  status: SupConvStatus;
  channel: SupChannel;
  subject: string;
  preview: string;
  lastAt: string; // relative label
  unread: number;
  slaSeconds: number; // remaining; negative = breached
  assignee?: string;
  priority: "low" | "normal" | "high" | "urgent";
  handoffReason?: string;
  messages: SupMessage[];
  context: SupContext;
}

const P = (name: string) => PEOPLE.find((p) => p.name === name)!;

const baseCtx = (over: Partial<SupContext> & Pick<SupContext, "accounts" | "aiSummary">): SupContext => ({
  kyc: "verified",
  segment: "Retail",
  tenant: "Ezymex Markets",
  since: "Mar 2025",
  wallet: 1240.5,
  lastDeposit: { amount: 1000, method: "USDT · TRC20", at: "19 Sep, 11:42" },
  openTickets: [],
  sentiment: "neutral",
  ltv: 4200,
  tags: [],
  language: "English",
  device: "iPhone 15 · iOS 19.2",
  ...over,
});

export const SUP_CONVERSATIONS: SupConversation[] = [
  {
    id: "CV-20931",
    client: P("Lucas Ferreira"),
    status: "agent",
    channel: "web",
    subject: "Withdrawal of 2,500 USDT still pending",
    preview: "It says processing for 3 hours now, your site says 15 minutes…",
    lastAt: "1m",
    unread: 2,
    slaSeconds: 214,
    assignee: "Priya Nair",
    priority: "urgent",
    handoffReason: "withdrawal dispute",
    messages: [
      { id: "m1", from: "client", text: "Hi, I requested a withdrawal of 2,500 USDT to my TRC20 wallet at 11:02 and it still says processing. Your website says 15 minutes.", time: "14:08" },
      { id: "m2", from: "ai", text: "Hi Lucas, thanks for reaching out. I can see withdrawal WD-904375 for 2,500.00 USDT (TRC20) created at 11:02 server time. It passed the automated checks but is now in manual review by our Finance team, which is why it is taking longer than the usual 15 minutes.", time: "14:08", cites: ["USDT TRC20 withdrawal times", "Why a withdrawal goes to manual review"], confidence: 92 },
      { id: "m3", from: "client", text: "Manual review why?? I have withdrawn before without any problem. I need this money today.", time: "14:10" },
      { id: "m4", from: "ai", text: "I understand this is urgent. Withdrawals above your 30-day average or to a newly whitelisted address are reviewed by a specialist. I'm connecting you with a member of our team who can see the review status right now.", time: "14:10", cites: ["Why a withdrawal goes to manual review"], confidence: 71 },
      { id: "m5", from: "handoff", text: "withdrawal dispute", time: "14:10", author: "Priya Nair", authorPhoto: PEOPLE[4]!.photo },
      { id: "m6", from: "note", text: "Address TQ7x…9KfE was whitelisted 2 days ago. Deposits came from a different wallet (TLa2…u8Qw). Checking with Finance before release — do not promise a time yet.", time: "14:12", author: "Priya Nair", authorPhoto: PEOPLE[4]!.photo },
      { id: "m7", from: "agent", text: "Hi Lucas, Priya from the Finance support team here. I've picked up your case and I'm checking the review with our payments desk now. Can you confirm that TQ7x…9KfE is a wallet you control?", time: "14:13", author: "Priya Nair", authorPhoto: PEOPLE[4]!.photo },
      { id: "m8", from: "client", text: "Yes it is my Trust Wallet. I added it on Monday because my old exchange blocked Brazil withdrawals.", time: "14:16" },
      { id: "m9", from: "client", text: "It says processing for 3 hours now, your site says 15 minutes…", time: "14:17", attachment: { name: "trustwallet-address.png", size: "284 KB" } },
    ],
    context: baseCtx({
      segment: "Active trader",
      since: "Jan 2025",
      accounts: [
        { login: "80412337", type: "live", group: "Pro · Hedging", equity: 18420.66 },
        { login: "80412904", type: "live", group: "Standard · Netting", equity: 2210.14 },
        { login: "70118452", type: "demo", group: "Demo · Pro", equity: 100000 },
      ],
      wallet: 2512.4,
      lastDeposit: { amount: 5000, method: "USDT · TRC20", at: "15 Sep, 09:21" },
      lastWithdrawal: { amount: 2500, status: "In review", at: "24 Sep, 11:02", id: "WD-904375" },
      openTickets: [
        { id: "TK-7731", title: "Withdrawal WD-904375 review", status: "processing" },
        { id: "TK-7702", title: "Swap-free request", status: "pending" },
      ],
      aiSummary: "Client requested 2,500 USDT to a TRC20 address whitelisted 2 days ago; withdrawal held for manual review. Frustrated about the delay. Profitable trader (+$6.1K in 30d), no chargebacks, deposits from a different wallet — source-of-funds check is the only blocker.",
      sentiment: "frustrated",
      ltv: 21860,
      tags: ["withdrawal", "whitelist", "VIP-candidate"],
      language: "Portuguese · English",
      device: "Chrome 141 · macOS",
    }),
  },
  {
    id: "CV-20930",
    client: P("Fatima Al-Sayed"),
    status: "ai",
    channel: "whatsapp",
    subject: "How to open a swap-free account",
    preview: "Claude: Swap-free (Islamic) accounts are available on Standard and Pro…",
    lastAt: "3m",
    unread: 0,
    slaSeconds: 0,
    priority: "normal",
    messages: [
      { id: "m1", from: "client", text: "السلام عليكم. Do you offer swap-free accounts? I trade gold mostly.", time: "14:12" },
      { id: "m2", from: "ai", text: "Wa alaikum assalam Fatima. Yes — swap-free (Islamic) accounts are available on Standard and Pro groups. XAUUSD is included with no overnight swap; an administration fee of $3.50 per lot applies only after 5 nights.", time: "14:12", cites: ["Swap-free (Islamic) accounts", "XAUUSD contract specification"], confidence: 96 },
      { id: "m3", from: "client", text: "Great. Can I convert my current account or do I need a new one?", time: "14:14" },
      { id: "m4", from: "ai", text: "You can convert account 80419921 directly from Accounts → Settings → Swap-free, as long as it has no open positions. I can also open a new Pro swap-free account for you now — would you like that?", time: "14:14", cites: ["Swap-free (Islamic) accounts"], confidence: 94 },
    ],
    context: baseCtx({
      segment: "VIP",
      tenant: "Dunes Capital",
      since: "Jul 2024",
      accounts: [{ login: "80419921", type: "live", group: "Pro · Hedging", equity: 64210.9 }],
      wallet: 8120,
      lastDeposit: { amount: 25000, method: "Bank wire · AED", at: "12 Sep, 16:05" },
      aiSummary: "VIP client asking about swap-free conversion for her Pro account. AI has answered with policy and next steps; no human needed unless she requests a new account opening with custom leverage.",
      sentiment: "positive",
      ltv: 88400,
      tags: ["islamic", "gold"],
      language: "Arabic · English",
      device: "WhatsApp · Android",
    }),
  },
  {
    id: "CV-20929",
    client: P("Daniel Okafor"),
    status: "needs_agent",
    channel: "app",
    subject: "Stop out on XAUUSD — requests compensation",
    preview: "The spread widened to 90 points at 15:30, this is not fair",
    lastAt: "4m",
    unread: 3,
    slaSeconds: -96,
    priority: "high",
    handoffReason: "trade dispute",
    messages: [
      { id: "m1", from: "client", text: "My account was stopped out at 15:30 yesterday. The spread on gold jumped to 90 points. I want my loss refunded.", time: "14:05" },
      { id: "m2", from: "ai", text: "I'm sorry to hear that, Daniel. At 15:30 on 23 Sep the US PCE release caused a liquidity gap; XAUUSD spreads widened across all liquidity providers for 11 seconds. I've pulled the tick history for your position #5829114.", time: "14:05", cites: ["Spreads during high-impact news", "Stop out level explained"], confidence: 78 },
      { id: "m3", from: "client", text: "I don't care about news. Other brokers didn't do that.", time: "14:07" },
      { id: "m4", from: "ai", text: "Trade compensation requests need a dealer to review the execution log, so I'm handing this over to a specialist now. Expected wait is under 2 minutes.", time: "14:07", confidence: 64 },
      { id: "m5", from: "handoff", text: "trade dispute · needs dealer review", time: "14:07" },
      { id: "m6", from: "client", text: "The spread widened to 90 points at 15:30, this is not fair", time: "14:10" },
    ],
    context: baseCtx({
      segment: "Retail",
      tenant: "Ezymex Markets",
      since: "Feb 2026",
      accounts: [{ login: "80433610", type: "live", group: "Standard · Hedging", equity: 42.18 }],
      wallet: 0,
      lastDeposit: { amount: 750, method: "Card · Visa", at: "02 Sep, 20:14" },
      openTickets: [{ id: "TK-7728", title: "Stop out compensation", status: "pending" }],
      aiSummary: "Client was stopped out on XAUUSD during the 23 Sep PCE release (spread 90 pts for 11s). Requests full refund of $708.40. Execution logs show fills within LP range; recommend explaining news spreads and offering a goodwill trading credit if policy allows.",
      sentiment: "frustrated",
      ltv: 750,
      tags: ["stop-out", "news-spread"],
      device: "Ezymex app · Android 16",
    }),
  },
  {
    id: "CV-20928",
    client: P("Nguyen Thu Ha"),
    status: "ai",
    channel: "app",
    subject: "Deposit shows 12/20 confirmations",
    preview: "Claude: Your deposit TX904412 will be credited automatically…",
    lastAt: "6m",
    unread: 0,
    slaSeconds: 0,
    priority: "low",
    messages: [
      { id: "m1", from: "client", text: "Chào, my deposit of 300 USDT is not in my wallet yet", time: "14:03" },
      { id: "m2", from: "ai", text: "Hi Thu Ha, your deposit TX904412 of 300.00 USDT (TRC20) has 12 of 20 network confirmations. It will be credited automatically in about a minute — no action is needed from you.", time: "14:03", cites: ["USDT TRC20 deposit confirmations"], confidence: 98 },
      { id: "m3", from: "client", text: "Ok it's there now, thank you!", time: "14:05" },
    ],
    context: baseCtx({
      tenant: "NovaTrade Asia",
      since: "Aug 2026",
      accounts: [{ login: "80440218", type: "live", group: "Cent · Hedging", equity: 29840, currency: "USC" }],
      wallet: 300,
      lastDeposit: { amount: 300, method: "USDT · TRC20", at: "24 Sep, 14:04" },
      aiSummary: "New client, deposit arrived after 20 confirmations. Resolved by AI; offer the Cent-to-Standard upgrade guide after first profitable week.",
      sentiment: "positive",
      ltv: 300,
      language: "Vietnamese",
      device: "Ezymex app · iOS 19",
    }),
  },
  {
    id: "CV-20927",
    client: P("Omar Haddad"),
    status: "agent",
    channel: "whatsapp",
    subject: "IB commission not paid for August",
    preview: "You: I've escalated this to the partners team, you'll hear back…",
    lastAt: "9m",
    unread: 0,
    slaSeconds: 1380,
    assignee: "Omar Haddad",
    priority: "high",
    handoffReason: "partner payout",
    messages: [
      { id: "m1", from: "client", text: "My August IB commission of $4,812 is missing from my wallet.", time: "13:52" },
      { id: "m2", from: "ai", text: "I can see August commission of $4,812.40 was calculated on 1 Sep but is on hold because 3 sub-accounts were flagged by our partner fraud checks. A partner manager needs to review this.", time: "13:52", cites: ["IB commission payout schedule", "Partner fraud flags"], confidence: 83 },
      { id: "m3", from: "handoff", text: "partner payout", time: "13:53", author: "Omar Haddad", authorPhoto: PEOPLE[5]!.photo },
      { id: "m4", from: "agent", text: "I've escalated this to the partners team, you'll hear back within 24 hours. The hold only affects 3 accounts; the rest ($4,103.10) can be released today.", time: "14:01", author: "Omar Haddad", authorPhoto: PEOPLE[5]!.photo },
    ],
    context: baseCtx({
      segment: "IB · Gold level",
      since: "Nov 2023",
      accounts: [{ login: "80400412", type: "live", group: "Pro · Hedging", equity: 12308.5 }],
      wallet: 3120.8,
      lastDeposit: { amount: 2000, method: "USDT · TRC20", at: "01 Aug, 10:30" },
      openTickets: [{ id: "TK-7719", title: "August IB payout hold", status: "processing" }],
      aiSummary: "Gold-level IB with 214 active clients. August payout held due to 3 flagged sub-accounts (shared device IDs). Partial release of $4,103.10 recommended.",
      ltv: 61300,
      tags: ["IB", "payout"],
      language: "Arabic",
      device: "WhatsApp · iOS",
    }),
  },
  {
    id: "CV-20926",
    client: P("Sofia Rossi"),
    status: "needs_agent",
    channel: "email",
    subject: "Proof of address rejected twice",
    preview: "I sent a utility bill from July, why is it rejected again?",
    lastAt: "12m",
    unread: 1,
    slaSeconds: 420,
    priority: "normal",
    handoffReason: "KYC exception",
    messages: [
      { id: "m1", from: "client", text: "I sent a utility bill from July, why is it rejected again? This is the second time.", time: "13:58", attachment: { name: "enel-bolletta-luglio.pdf", size: "1.2 MB" } },
      { id: "m2", from: "ai", text: "Hi Sofia, proof of address must be issued within the last 90 days and show your full name and address. Your July bill is valid by date, but the name on it is 'S. Rossi Bianchi'. A KYC specialist will review whether it can be accepted.", time: "13:59", cites: ["Accepted proof of address documents"], confidence: 74 },
      { id: "m3", from: "handoff", text: "KYC exception · name mismatch", time: "13:59" },
    ],
    context: baseCtx({
      kyc: "rejected",
      since: "Sep 2026",
      tenant: "Aurum FX",
      accounts: [{ login: "80441107", type: "demo", group: "Demo · Standard", equity: 10000 }],
      wallet: 0,
      lastDeposit: { amount: 0, method: "—", at: "No deposits yet" },
      aiSummary: "Prospect blocked at KYC: PoA rejected twice for name mismatch (married name). Ask for a marriage certificate or bank statement to unblock first deposit.",
      language: "Italian",
      device: "Gmail · Web",
      ltv: 0,
    }),
  },
  {
    id: "CV-20925",
    client: P("James Carter"),
    status: "ai",
    channel: "web",
    subject: "Leverage change to 1:500",
    preview: "Claude: Your Pro account leverage has been updated to 1:500.",
    lastAt: "15m",
    unread: 0,
    slaSeconds: 0,
    priority: "low",
    messages: [
      { id: "m1", from: "client", text: "Can I change my leverage from 1:200 to 1:500?", time: "13:49" },
      { id: "m2", from: "ai", text: "Yes, you're eligible for 1:500 on account 80412881 (equity below $50,000, no open positions). I've submitted the change and it is now active.", time: "13:49", cites: ["Leverage tiers by equity"], confidence: 97 },
    ],
    context: baseCtx({
      accounts: [{ login: "80412881", type: "live", group: "Pro · Hedging", equity: 9412.3 }],
      aiSummary: "Leverage raised to 1:500 by AI action. Nothing pending.",
      sentiment: "positive",
      device: "Firefox · Windows 11",
    }),
  },
  {
    id: "CV-20924",
    client: P("Aisha Rahman"),
    status: "agent",
    channel: "app",
    subject: "Prop challenge breach — daily loss",
    preview: "Mei Lin: I've reviewed the equity snapshot at 00:00 server…",
    lastAt: "22m",
    unread: 0,
    slaSeconds: 2460,
    assignee: "Mei Lin",
    priority: "normal",
    handoffReason: "prop rule appeal",
    messages: [
      { id: "m1", from: "client", text: "My $50K challenge was failed for daily loss but I only lost $2,300.", time: "13:31" },
      { id: "m2", from: "ai", text: "Daily loss is measured from the higher of balance or equity at 00:00 server time (GMT+3). Your equity at midnight was $52,410 including floating profit, so the 5% limit was $2,620 from that level.", time: "13:31", cites: ["Prop daily loss rule"], confidence: 88 },
      { id: "m3", from: "handoff", text: "prop rule appeal", time: "13:33", author: "Mei Lin", authorPhoto: PEOPLE[8]!.photo },
      { id: "m4", from: "agent", text: "I've reviewed the equity snapshot at 00:00 server time and the breach is valid. As a one-time courtesy we can offer a free reset of the challenge.", time: "13:52", author: "Mei Lin", authorPhoto: PEOPLE[8]!.photo },
    ],
    context: baseCtx({
      segment: "Prop trader",
      accounts: [{ login: "90120348", type: "live", group: "Prop · 50K Phase 1", equity: 47590 }],
      aiSummary: "Challenge breached on daily loss using equity-based midnight snapshot. Agent offered one free reset.",
      tenant: "Ezymex Markets",
      language: "Malay · English",
    }),
  },
  {
    id: "CV-20923",
    client: P("Hassan Karimi"),
    status: "needs_agent",
    channel: "whatsapp",
    subject: "Account locked after 5 login attempts",
    preview: "Hesabım kilitlendi, 2FA kodu gelmiyor",
    lastAt: "26m",
    unread: 2,
    slaSeconds: -312,
    priority: "high",
    handoffReason: "security · identity check",
    messages: [
      { id: "m1", from: "client", text: "Hesabım kilitlendi, 2FA kodu gelmiyor", time: "13:38" },
      { id: "m2", from: "ai", text: "Merhaba Hassan. Hesabınız 5 başarısız girişten sonra güvenlik amacıyla kilitlendi. Kimlik doğrulaması için sizi bir uzmana aktarıyorum.", time: "13:38", cites: ["Account lock & 2FA recovery"], confidence: 81 },
      { id: "m3", from: "handoff", text: "security · identity check", time: "13:38" },
    ],
    context: baseCtx({
      accounts: [{ login: "80425570", type: "live", group: "Standard · Hedging", equity: 3860.2 }],
      aiSummary: "Account locked after 5 failed logins from a new IP (Istanbul). 2FA SMS not delivered — carrier issue likely. Verify identity via selfie before unlocking.",
      language: "Turkish",
      device: "WhatsApp · Android",
      sentiment: "frustrated",
    }),
  },
  {
    id: "CV-20922",
    client: P("Carlos Mendoza"),
    status: "resolved",
    channel: "email",
    subject: "Monthly statement for tax purposes",
    preview: "Thanks, got the PDF.",
    lastAt: "41m",
    unread: 0,
    slaSeconds: 0,
    priority: "low",
    messages: [
      { id: "m1", from: "client", text: "Necesito el estado de cuenta de agosto para mi contador.", time: "13:10" },
      { id: "m2", from: "ai", text: "Hola Carlos, he generado el estado de cuenta de agosto de la cuenta 80418800. Puede descargarlo desde Informes → Estados de cuenta o desde el enlace que le he enviado por correo.", time: "13:10", cites: ["Account statements"], confidence: 95 },
      { id: "m3", from: "client", text: "Thanks, got the PDF.", time: "13:21" },
      { id: "m4", from: "system", text: "Conversation resolved by Claude · CSAT 5/5", time: "13:22" },
    ],
    context: baseCtx({
      accounts: [{ login: "80418800", type: "live", group: "Standard · Netting", equity: 5120.75 }],
      aiSummary: "Statement delivered by AI. Resolved with 5/5 rating.",
      sentiment: "positive",
      language: "Spanish",
    }),
  },
  {
    id: "CV-20921",
    client: P("Yuki Tanaka"),
    status: "ai",
    channel: "web",
    subject: "API key for Python bot",
    preview: "Claude: You can create a trading API key under API & Algo…",
    lastAt: "48m",
    unread: 0,
    slaSeconds: 0,
    priority: "low",
    messages: [
      { id: "m1", from: "client", text: "How do I connect my Python bot? Is there a REST API?", time: "13:02" },
      { id: "m2", from: "ai", text: "Yes — create a trading API key under API & Algo → Keys, restrict it to your IP, and use the REST or WebSocket endpoints. Rate limit is 20 requests/second per key.", time: "13:02", cites: ["Trading API quick start"], confidence: 93 },
    ],
    context: baseCtx({
      accounts: [{ login: "80421199", type: "live", group: "ECN · Netting", equity: 27340 }],
      aiSummary: "Algo trader asking about REST/WebSocket API. Answered by AI.",
      language: "Japanese · English",
      tenant: "NovaTrade Asia",
    }),
  },
  {
    id: "CV-20920",
    client: P("Laila Farouk"),
    status: "resolved",
    channel: "app",
    subject: "Change registered phone number",
    preview: "Elena Petrova: Your phone number has been updated.",
    lastAt: "1h",
    unread: 0,
    slaSeconds: 0,
    assignee: "Elena Petrova",
    priority: "normal",
    messages: [
      { id: "m1", from: "client", text: "I changed my SIM, please update my number to +20 100 482 1177", time: "12:31" },
      { id: "m2", from: "handoff", text: "profile change · identity check", time: "12:31", author: "Elena Petrova", authorPhoto: PEOPLE[12]!.photo },
      { id: "m3", from: "agent", text: "Your phone number has been updated after the selfie check. You'll receive a confirmation SMS.", time: "12:44", author: "Elena Petrova", authorPhoto: PEOPLE[12]!.photo },
      { id: "m4", from: "system", text: "Conversation resolved by Elena Petrova · CSAT 4/5", time: "12:45" },
    ],
    context: baseCtx({
      accounts: [{ login: "80430051", type: "live", group: "Standard · Hedging", equity: 1842.6 }],
      aiSummary: "Phone number changed after selfie verification.",
      tenant: "Dunes Capital",
      language: "Arabic",
    }),
  },
];

/* ------------------------------------------------------------------ */
/* Canned replies                                                      */
/* ------------------------------------------------------------------ */

export interface SupCanned {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  category: string;
  language: string;
  usage: number;
  updatedBy: string;
  updated: string;
  shared: boolean;
}

export const SUP_VARIABLES = ["first_name", "login", "amount", "withdrawal_id", "eta", "agent_name", "kb_link", "tenant_name", "deposit_id", "leverage"] as const;

export const SUP_CANNED: SupCanned[] = [
  { id: "cr1", shortcut: "/withdrawal-delay", title: "Withdrawal in manual review", body: "Hi {{first_name}}, your withdrawal {{withdrawal_id}} of {{amount}} is in a routine manual review by our Finance team. Most reviews complete within {{eta}}. I'll update you here as soon as it is released.", category: "Withdrawals", language: "EN", usage: 1284, updatedBy: "Priya Nair", updated: "22 Sep 2026", shared: true },
  { id: "cr2", shortcut: "/deposit-confirmations", title: "USDT deposit confirmations", body: "Hi {{first_name}}, USDT TRC20 deposits are credited after 20 network confirmations (about 1 minute). Your deposit {{deposit_id}} will be credited automatically — no action needed.", category: "Deposits", language: "EN", usage: 2210, updatedBy: "Mei Lin", updated: "18 Sep 2026", shared: true },
  { id: "cr3", shortcut: "/kyc-poa", title: "Proof of address requirements", body: "Hi {{first_name}}, we accept utility bills, bank statements or government letters issued within the last 90 days that show your full name and residential address. Screenshots and mobile bills are not accepted.", category: "KYC", language: "EN", usage: 1876, updatedBy: "Zara Sheikh", updated: "10 Sep 2026", shared: true },
  { id: "cr4", shortcut: "/news-spreads", title: "Spreads during high-impact news", body: "Hi {{first_name}}, during high-impact releases liquidity providers widen their quotes for a few seconds. Your account {{login}} was executed within the prices available from our LPs at that moment. You can review our news trading guide here: {{kb_link}}", category: "Trading", language: "EN", usage: 642, updatedBy: "Priya Nair", updated: "24 Sep 2026", shared: true },
  { id: "cr5", shortcut: "/leverage-change", title: "Leverage updated", body: "Done, {{first_name}} — leverage on account {{login}} is now {{leverage}}. The change applies to new and existing positions immediately.", category: "Accounts", language: "EN", usage: 988, updatedBy: "Carlos Mendoza", updated: "02 Sep 2026", shared: true },
  { id: "cr6", shortcut: "/handover-intro", title: "Agent introduction after AI handoff", body: "Hi {{first_name}}, {{agent_name}} from the {{tenant_name}} support team here. I've read your conversation with our assistant, so there's no need to repeat anything — I'm on it now.", category: "General", language: "EN", usage: 3412, updatedBy: "Mei Lin", updated: "30 Aug 2026", shared: true },
  { id: "cr7", shortcut: "/retiro-demora", title: "Retiro en revisión", body: "Hola {{first_name}}, tu retiro {{withdrawal_id}} por {{amount}} está en revisión manual. La mayoría se completan en {{eta}}. Te aviso por aquí en cuanto se libere.", category: "Withdrawals", language: "ES", usage: 418, updatedBy: "Carlos Mendoza", updated: "12 Sep 2026", shared: true },
  { id: "cr8", shortcut: "/swap-free", title: "Swap-free account conversion", body: "{{first_name}}, you can convert account {{login}} to swap-free from Accounts → Settings → Swap-free once it has no open positions. An admin fee applies only after 5 nights.", category: "Accounts", language: "EN", usage: 731, updatedBy: "Omar Haddad", updated: "05 Sep 2026", shared: true },
  { id: "cr9", shortcut: "/ib-payout-hold", title: "IB payout on hold", body: "Hi {{first_name}}, part of your commission ({{amount}}) is on hold while our partner team reviews flagged sub-accounts. The unaffected amount has been released today.", category: "Partners", language: "EN", usage: 204, updatedBy: "Omar Haddad", updated: "20 Sep 2026", shared: false },
  { id: "cr10", shortcut: "/account-unlock", title: "Account unlock after identity check", body: "Thanks {{first_name}}, your identity is confirmed and account {{login}} is unlocked. Please set a new password and re-enable 2FA from Profile → Security.", category: "Security", language: "EN", usage: 557, updatedBy: "Elena Petrova", updated: "14 Sep 2026", shared: true },
  { id: "cr11", shortcut: "/sahb-tarkheer", title: "تأخير السحب", body: "مرحباً {{first_name}}، طلب السحب {{withdrawal_id}} بقيمة {{amount}} قيد المراجعة اليدوية من فريق المالية. نتوقع الانتهاء خلال {{eta}}.", category: "Withdrawals", language: "AR", usage: 366, updatedBy: "Omar Haddad", updated: "16 Sep 2026", shared: true },
  { id: "cr12", shortcut: "/prop-reset", title: "Prop challenge courtesy reset", body: "{{first_name}}, the breach on your challenge is valid, but as a one-time courtesy we've issued a free reset. It is available in Prop → My challenges.", category: "Prop", language: "EN", usage: 189, updatedBy: "Mei Lin", updated: "21 Sep 2026", shared: false },
];

/* ------------------------------------------------------------------ */
/* AI knowledge base                                                   */
/* ------------------------------------------------------------------ */

export interface SupArticle {
  id: string;
  title: string;
  category: string;
  body: string;
  tags: string[];
  usedIn: number; // AI answers (30d)
  helpful: number; // % helpful
  updated: string;
  updatedBy: string;
  status: "published" | "draft" | "review" | "stale";
  languages: number;
  tenants: string;
}

export const SUP_KB_CATEGORIES = ["Deposits", "Withdrawals", "Accounts", "Trading", "KYC", "Partners", "Prop", "Security", "Platform"] as const;

export const SUP_ARTICLES: SupArticle[] = [
  { id: "kb101", title: "USDT TRC20 withdrawal times", category: "Withdrawals", body: "Withdrawals to USDT on the TRON (TRC20) network are processed automatically within 15 minutes, 24/7, when they pass automated checks. The network fee is 1 USDT. Withdrawals above the client's 30-day average, to an address whitelisted less than 72 hours ago, or when the deposit source differs from the withdrawal destination are routed to manual review, which completes within 4 business hours.", tags: ["usdt", "trc20", "withdrawal", "sla"], usedIn: 4812, helpful: 91, updated: "22 Sep 2026", updatedBy: "Priya Nair", status: "published", languages: 22, tenants: "All tenants" },
  { id: "kb102", title: "Why a withdrawal goes to manual review", category: "Withdrawals", body: "A withdrawal is reviewed manually when: the amount exceeds 3× the 30-day average; the destination was whitelisted within 72 hours; deposits came from a different wallet; or the account has an open AML flag. Agents must never promise a release time before Finance confirms.", tags: ["withdrawal", "review", "aml"], usedIn: 2107, helpful: 84, updated: "20 Sep 2026", updatedBy: "Elena Petrova", status: "published", languages: 22, tenants: "All tenants" },
  { id: "kb103", title: "USDT TRC20 deposit confirmations", category: "Deposits", body: "Deposits are credited after 20 TRON network confirmations, usually about one minute. Deposits below 10 USDT are not credited. Sending on the wrong network (ERC20, BEP20) requires a manual recovery ticket with a $25 fee.", tags: ["deposit", "usdt", "confirmations"], usedIn: 6390, helpful: 95, updated: "11 Sep 2026", updatedBy: "Mei Lin", status: "published", languages: 22, tenants: "All tenants" },
  { id: "kb104", title: "Swap-free (Islamic) accounts", category: "Accounts", body: "Swap-free accounts are available on Standard and Pro groups. No overnight swaps are charged; an administration fee of $3.50 per lot applies after 5 consecutive nights on metals and indices. Accounts can be converted when no positions are open.", tags: ["islamic", "swap-free"], usedIn: 1488, helpful: 93, updated: "05 Sep 2026", updatedBy: "Omar Haddad", status: "published", languages: 18, tenants: "All tenants" },
  { id: "kb105", title: "Spreads during high-impact news", category: "Trading", body: "During high-impact releases (NFP, CPI, PCE, central bank decisions) liquidity providers widen quotes, typically for 5–30 seconds. Ezymex passes through LP prices with no dealer intervention. Compensation is only considered if execution was outside the prevailing LP range.", tags: ["spread", "news", "execution"], usedIn: 912, helpful: 72, updated: "24 Sep 2026", updatedBy: "Priya Nair", status: "review", languages: 12, tenants: "All tenants" },
  { id: "kb106", title: "Stop out level explained", category: "Trading", body: "Stop out occurs when margin level falls to 50% (Standard) or 30% (Pro, ECN). Positions are closed starting with the largest floating loss until margin level recovers.", tags: ["margin", "stop-out"], usedIn: 1765, helpful: 88, updated: "01 Aug 2026", updatedBy: "Priya Nair", status: "published", languages: 22, tenants: "All tenants" },
  { id: "kb107", title: "Accepted proof of address documents", category: "KYC", body: "Utility bills, bank statements, tax letters or government correspondence issued within 90 days, showing the full legal name and residential address. Name variations (married names) require supporting evidence such as a marriage certificate.", tags: ["kyc", "poa"], usedIn: 3021, helpful: 86, updated: "09 Sep 2026", updatedBy: "Zara Sheikh", status: "published", languages: 22, tenants: "All tenants" },
  { id: "kb108", title: "IB commission payout schedule", category: "Partners", body: "IB commissions are calculated daily and paid to the partner wallet on the 1st of each month for the previous month. Commissions from accounts under fraud review are held until the review completes.", tags: ["ib", "commission", "payout"], usedIn: 804, helpful: 89, updated: "28 Aug 2026", updatedBy: "Omar Haddad", status: "published", languages: 16, tenants: "Ezymex Markets, Aurum FX" },
  { id: "kb109", title: "Prop daily loss rule", category: "Prop", body: "Daily loss is measured from the higher of balance or equity at 00:00 server time (GMT+3). Breaching 5% (Phase 1/2) or 4% (Funded) fails the account immediately.", tags: ["prop", "daily-loss"], usedIn: 1322, helpful: 81, updated: "15 Sep 2026", updatedBy: "Mei Lin", status: "published", languages: 20, tenants: "Ezymex Markets" },
  { id: "kb110", title: "Leverage tiers by equity", category: "Accounts", body: "Maximum leverage: 1:1000 up to $5,000 equity, 1:500 up to $50,000, 1:200 up to $250,000 and 1:100 above. Some jurisdictions are capped at 1:30.", tags: ["leverage"], usedIn: 2240, helpful: 94, updated: "18 Jul 2026", updatedBy: "Carlos Mendoza", status: "stale", languages: 22, tenants: "All tenants" },
  { id: "kb111", title: "Account lock & 2FA recovery", category: "Security", body: "Accounts lock for 30 minutes after 5 failed logins. If 2FA is unavailable, the client must pass a selfie liveness check before an agent resets 2FA.", tags: ["2fa", "security", "lock"], usedIn: 690, helpful: 83, updated: "12 Sep 2026", updatedBy: "Elena Petrova", status: "published", languages: 22, tenants: "All tenants" },
  { id: "kb112", title: "Trading API quick start", category: "Platform", body: "Create a key in API & Algo → Keys, restrict to IP, use REST (orders, positions) or WebSocket (quotes, account). Rate limit: 20 req/s per key.", tags: ["api", "algo"], usedIn: 238, helpful: 90, updated: "03 Sep 2026", updatedBy: "Mei Lin", status: "published", languages: 6, tenants: "All tenants" },
  { id: "kb113", title: "Bonus withdrawal conditions", category: "Deposits", body: "Deposit bonuses are credit and cannot be withdrawn. Profits are withdrawable at any time; the bonus is removed if equity falls below the credit amount.", tags: ["bonus"], usedIn: 0, helpful: 0, updated: "24 Sep 2026", updatedBy: "Priya Nair", status: "draft", languages: 1, tenants: "Aurum FX" },
];

/** Canned "test the bot" answers for the knowledge-base playground. */
export const SUP_BOT_TESTS: { q: string; answer: string; cites: string[]; confidence: number; handoff?: boolean }[] = [
  { q: "Why is my USDT withdrawal still pending after 2 hours?", answer: "USDT TRC20 withdrawals are usually processed within 15 minutes. If yours is taking longer, it has most likely been routed to a routine manual review — this happens when the amount is above your 30-day average or the address was whitelisted recently. Reviews complete within 4 business hours, and you'll get a notification as soon as it's released.", cites: ["kb101", "kb102"], confidence: 91 },
  { q: "Can I get an Islamic account for gold trading?", answer: "Yes. Swap-free accounts are available on Standard and Pro groups and include XAUUSD with no overnight swap. A $3.50 per lot admin fee applies after 5 consecutive nights. You can convert an existing account from Accounts → Settings once it has no open positions.", cites: ["kb104"], confidence: 95 },
  { q: "I was stopped out during NFP, I want a refund", answer: "I'm sorry about the loss. During NFP, liquidity providers widen quotes for a few seconds and we pass these prices through without intervention. Compensation is only possible if your fill was outside the LP range — I'll connect you with a dealer who can check the execution log for your trade.", cites: ["kb105", "kb106"], confidence: 68, handoff: true },
  { q: "What leverage can I get with $20,000?", answer: "With $20,000 equity you can use up to 1:500 leverage. Above $50,000 the maximum becomes 1:200. Note: some jurisdictions are capped at 1:30.", cites: ["kb110"], confidence: 87 },
];

/* ------------------------------------------------------------------ */
/* CSAT                                                                */
/* ------------------------------------------------------------------ */

export const SUP_CSAT_KPIS = {
  csat: 94.6,
  csatDelta: 1.8,
  nps: 62,
  npsDelta: 4,
  frt: 41, // seconds
  frtDelta: -12,
  aiResolution: 68.4,
  aiResolutionDelta: 5.2,
  responses: 3184,
  conversations30d: 18420,
};

const trendR = seeded(7331);
/** 30-day daily CSAT (%) and AI resolution (%) — ending 24 Sep 2026. */
export const SUP_CSAT_TREND = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 7, 26 + i));
  return {
    date: day.toISOString().slice(0, 10),
    label: `${String(day.getUTCDate()).padStart(2, "0")} ${["Aug", "Sep"][day.getUTCMonth() - 7]}`,
    csat: +(91.2 + i * 0.11 + trendR.normal() * 0.9).toFixed(1),
    ai: +(60.8 + i * 0.26 + trendR.normal() * 1.4).toFixed(1),
    volume: Math.round(560 + trendR.range(-80, 120) + (i % 7 === 5 || i % 7 === 6 ? -180 : 0)),
  };
});

export const SUP_CSAT_DISTRIBUTION = [
  { stars: 5, count: 2412 },
  { stars: 4, count: 498 },
  { stars: 3, count: 142 },
  { stars: 2, count: 71 },
  { stars: 1, count: 61 },
];

export const SUP_CSAT_BY_CHANNEL = [
  { channel: "Web chat", csat: 95.2, share: 41 },
  { channel: "Mobile app", csat: 94.9, share: 33 },
  { channel: "WhatsApp", csat: 93.1, share: 18 },
  { channel: "Email", csat: 90.4, share: 8 },
];

export interface SupFeedback {
  id: string;
  client: Person;
  rating: number;
  comment: string;
  agent: string; // "Claude" or agent name
  conv: string;
  at: string;
  channel: SupChannel;
  tenant: string;
}

export const SUP_FEEDBACK: SupFeedback[] = [
  { id: "f1", client: person(9), rating: 5, comment: "Claude sorted my statement in seconds. Didn't even need a human.", agent: "Claude", conv: "CV-20922", at: "13:22", channel: "email", tenant: "Ezymex Markets" },
  { id: "f2", client: person(3), rating: 5, comment: "Deposit issue explained clearly, it arrived exactly when the bot said.", agent: "Claude", conv: "CV-20928", at: "14:05", channel: "app", tenant: "NovaTrade Asia" },
  { id: "f3", client: person(20), rating: 4, comment: "Elena was quick, but the selfie check was a bit annoying.", agent: "Elena Petrova", conv: "CV-20920", at: "12:45", channel: "app", tenant: "Dunes Capital" },
  { id: "f4", client: person(15), rating: 2, comment: "Waited 20 minutes for a human after the bot could not unlock my account.", agent: "Claude", conv: "CV-20899", at: "11:31", channel: "whatsapp", tenant: "Ezymex Markets" },
  { id: "f5", client: person(22), rating: 5, comment: "Mei Lin gave me a free reset on my challenge. Very fair.", agent: "Mei Lin", conv: "CV-20881", at: "10:58", channel: "app", tenant: "Ezymex Markets" },
  { id: "f6", client: person(13), rating: 3, comment: "Answer was correct but I had to ask twice to get the IB payout date.", agent: "Claude", conv: "CV-20874", at: "10:12", channel: "web", tenant: "Aurum FX" },
  { id: "f7", client: person(10), rating: 5, comment: "Omar replied in Arabic and fixed my commission hold same day.", agent: "Omar Haddad", conv: "CV-20870", at: "09:40", channel: "whatsapp", tenant: "Dunes Capital" },
  { id: "f8", client: person(7), rating: 1, comment: "Refund refused for news spread. Very disappointed.", agent: "Priya Nair", conv: "CV-20862", at: "09:02", channel: "web", tenant: "Ezymex Markets" },
];

/** CSAT per agent including the AI bot row. */
export const SUP_AGENT_SCORES = [
  { name: "Claude · AI", photo: "", ai: true, csat: 93.8, conversations: 12604, frt: 2, resolution: 68.4 },
  ...SUP_AGENTS.map((a) => ({ name: a.person.name, photo: a.person.photo, ai: false, csat: a.csat, conversations: a.resolved, frt: a.frt, resolution: 0 })),
];
