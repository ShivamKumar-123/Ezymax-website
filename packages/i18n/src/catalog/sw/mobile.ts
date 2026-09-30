import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (one word each)
  "tab.home": "Nyumbani",
  "tab.markets": "Masoko",
  "tab.trade": "Biashara",
  "tab.portfolio": "Portfolio",
  "tab.more": "Zaidi",

  // Onboarding (3 slides). Titles are tall uppercase display type: keep them short.
  "onboarding.skip": "Ruka",
  "onboarding.next": "Ifuatayo",
  "onboarding.getStarted": "Anza",
  "onboarding.haveAccount": "Nina akaunti",
  "onboarding.welcome.title": "Ingia sokoni",
  "onboarding.welcome.body": "Forex, metali, fahirisi, nishati, crypto na hisa katika akaunti moja, pamoja na ufadhili wa papo hapo kwa USDT.",
  "onboarding.markets.title": "Kila tiki, moja kwa moja",
  "onboarding.markets.body": "Bei halisi za bid na ask, chati zako mwenyewe na Nunua na Uza kwa mguso mmoja, zimeundwa kwa simu.",
  "onboarding.security.title": "Salama kabisa",
  "onboarding.security.body": "Misimbo ya barua pepe kwenye vifaa vipya, misimbo ya uthibitisho kwa utoaji na hifadhi salama ya kipindi chako.",
  "onboarding.step": "{n} kati ya {total}",

  // Shared states
  "state.offline.title": "Muunganisho umekatika",
  "state.offline.body": "Angalia muunganisho wako wa intaneti. Bei na akaunti yako vitaunganishwa tena kiotomatiki.",
  "state.reconnecting": "Inaunganisha tena…",
  "state.error.title": "Hitilafu imetokea",
  "state.error.body": "Hatukuweza kupakia hii. Vuta chini au gusa ili ujaribu tena.",
  "state.maintenance.title": "Matengenezo yanaendelea",
  "state.maintenance.body": "Tunaboresha Kalks. Nafasi na fedha zako ziko salama. Tafadhali rudi baada ya muda mfupi.",
  "state.sessionExpired": "Kipindi chako kimeisha. Tafadhali ingia tena.",
  "state.updated": "Imesasishwa {time}",
  "state.pullToRefresh": "Vuta ili kuonyesha upya",

  viewOnly: "Ufikiaji wa kutazama tu",
  viewOnlyBody: "Login hii inaweza kutazama akaunti zilizoshirikiwa lakini haiwezi kufanya mabadiliko.",

  // Common short labels
  "action.retry": "Jaribu tena",
  "action.openWeb": "Fungua kwenye Eneo la Mteja",
  "action.signOut": "Toka",
  "action.seeAll": "Tazama zote",
  "a11y.close": "Funga",
  "a11y.back": "Rudi",
};
export default mobile;
