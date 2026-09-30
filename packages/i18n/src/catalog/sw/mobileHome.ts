import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Habari za asubuhi, {name}",
  "greet.afternoon": "Habari za mchana, {name}",
  "greet.evening": "Habari za jioni, {name}",
  equity: "Equity",
  closedToday: "Zilizofungwa leo",
  openPnl: "P&L iliyo wazi",
  allLive: "Akaunti zote halisi {amount}",
  "quick.deposit": "Weka",
  "quick.withdraw": "Toa",
  "quick.transfer": "Hamisha",
  "quick.trade": "Biashara",
  movers: "Wanaosonga zaidi",
  news: "Vichwa vya habari",
  allNews: "Habari zote",
  notifications: "Arifa",
  "kyc.title": "Thibitisha utambulisho wako",
  "kyc.body": "Uthibitishaji hufungua biashara halisi na utoaji wa pesa. Huchukua dakika chache.",
  "kyc.pending": "Uthibitishaji unakaguliwa",
  "kyc.pendingBody": "Tunakagua hati zako. Utapokea arifa ukaguzi ukikamilika.",
  "kyc.action": "Endelea",
  "noAccount.title": "Fungua akaunti yako ya kwanza",
  "noAccount.body": "Akaunti ya demo iko tayari ndani ya sekunde chache ikiwa na fedha za mtandaoni. Nenda halisi ukiwa tayari.",
  "noAccount.action": "Fungua akaunti",
  "news.empty": "Hakuna vichwa vya habari kwa sasa.",
  "a11y.bell": "Arifa, {count} hazijasomwa",

  // Explore: one colour block per module (title on two short lines at most, hint on two lines)
  "explore.title": "Gundua",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Fuata wafanyabiashara waliothibitika",
  "explore.prop": "Changamoto ya Prop",
  "explore.propHint": "Pata ufadhili wa kufanya biashara",
  "explore.academy": "Academy",
  "explore.academyHint": "Jifunze biashara hatua kwa hatua",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Geuza wazo kuwa mkakati",
  "explore.invite": "Alika marafiki",
  "explore.inviteHint": "Pata mapato wanapofanya biashara",
};
export default mobileHome;
